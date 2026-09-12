const { clamp, defaultDemandPressure, defaultMarketPriceFormula } = require('./formulas');
const { getCongestionLevel } = require('./CongestionLevels');

function round(n, dp = 4) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * PricingEngine
 *
 * Implements DYNAMIC_PRICING.md end to end:
 *   demand_pressure  = demandPressureFormula(supply, demand)
 *   market_price     = marketPriceFormula(floor, elasticity, demand_pressure)
 *   final_price      = clamp(market_price + congestion_adjustment, floor, ceiling)
 *
 * Both formulas are injected (see formulas.js) so the exact model is
 * configurable rather than hardcoded, per the doc's own instruction. This
 * engine does NOT decide matching or settlement — it only produces a quote
 * and records what went into it.
 */
class PricingEngine {
  constructor({ marketPriceFormula = defaultMarketPriceFormula, demandPressureFormula = defaultDemandPressure } = {}) {
    this.zones = new Map(); // zoneId -> { floor, ceiling, elasticityFactor, repricingIntervalMs, congestionOverrides, lastQuote }
    this.auditLog = []; // rule 5: every quote's inputs, kept for the life of the process
    this.marketPriceFormula = marketPriceFormula;
    this.demandPressureFormula = demandPressureFormula;
  }

  /** Define or update a zone's pricing band and behavior. */
  configureZone(zoneId, { floor, ceiling, elasticityFactor = 1.0, repricingIntervalMs = 60000, congestionOverrides = {} } = {}) {
    if (floor == null || ceiling == null) {
      throw new Error('configureZone requires both floor and ceiling');
    }
    if (Number(floor) > Number(ceiling)) {
      throw new Error(`floor (${floor}) cannot exceed ceiling (${ceiling})`);
    }
    const existing = this.zones.get(zoneId);
    const zone = {
      zoneId,
      floor: Number(floor),
      ceiling: Number(ceiling),
      elasticityFactor: Number(elasticityFactor),
      repricingIntervalMs: Number(repricingIntervalMs),
      congestionOverrides,
      lastQuote: existing ? existing.lastQuote : null,
    };
    this.zones.set(zoneId, zone);
    return { ...zone };
  }

  getZoneConfig(zoneId) {
    const zone = this.zones.get(zoneId);
    if (!zone) {
      const err = new Error(`Zone ${zoneId} is not configured — call configureZone() first`);
      err.code = 'ZONE_NOT_CONFIGURED';
      throw err;
    }
    return zone;
  }

  listZones() {
    return Array.from(this.zones.values()).map((z) => ({ ...z }));
  }

  /**
   * computeQuote — the main entry point. Called on a schedule (see
   * PricingScheduler) or on demand whenever supply/demand/congestion
   * inputs change.
   */
  computeQuote(zoneId, { supplyKwh, demandKwh, congestionLevel = 'NORMAL' }) {
    if (supplyKwh == null || demandKwh == null) {
      throw new Error('computeQuote requires supplyKwh and demandKwh');
    }
    const zone = this.getZoneConfig(zoneId);
    const level = getCongestionLevel(congestionLevel, zone.congestionOverrides);

    const demandPressure = this.demandPressureFormula({ supplyKwh, demandKwh });
    const marketPrice = this.marketPriceFormula({
      floor: zone.floor,
      elasticityFactor: zone.elasticityFactor,
      demandPressure,
    });
    const congestionAdjustment = level.surchargePerKwh;
    const rawFinalPrice = marketPrice + congestionAdjustment;
    const finalPricePerKwh = clamp(rawFinalPrice, zone.floor, zone.ceiling); // rules 1 & 2

    const quote = {
      zoneId,
      timestamp: new Date().toISOString(),
      inputs: { supplyKwh, demandKwh, congestionLevel: level.key }, // rule 5
      band: { floor: zone.floor, ceiling: zone.ceiling, elasticityFactor: zone.elasticityFactor },
      demandPressure: round(demandPressure),
      marketPrice: round(marketPrice),
      congestionAdjustment: round(congestionAdjustment),
      rawFinalPrice: round(rawFinalPrice),
      finalPricePerKwh: round(finalPricePerKwh),
      wasClamped: round(rawFinalPrice) !== round(finalPricePerKwh),
      tradeAllowed: level.tradeAllowed, // rule 4
    };

    zone.lastQuote = quote;
    this.auditLog.push(quote);
    return quote;
  }

  getLastQuote(zoneId) {
    return this.getZoneConfig(zoneId).lastQuote;
  }

  /** rule 5: store the inputs used for every trade quote, for auditability. */
  getAuditLog(zoneId) {
    if (!zoneId) return [...this.auditLog];
    return this.auditLog.filter((q) => q.zoneId === zoneId);
  }
}

module.exports = PricingEngine;
