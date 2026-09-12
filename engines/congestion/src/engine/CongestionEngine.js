const { LoadTracker } = require('./LoadTracker');

/**
 * CongestionEngine
 *
 * Implements CONGESTION_MANAGEMENT.md end to end:
 *
 *   inputs: zone capacity, current load, congestion threshold,
 *           active trades, new trade requested quantity
 *
 *   status:
 *     NORMAL       load comfortably below threshold
 *     ELEVATED     load approaching threshold (surcharge territory)
 *     CONSTRAINED  load at/above capacity — new trades throttled or paused
 *
 * This engine decides the status string. It does NOT decide price or
 * surcharge amounts — that mapping (NORMAL/ELEVATED/CONSTRAINED ->
 * surchargePerKwh / tradeAllowed) already exists in
 * solarlink-pricing-engine/src/engine/CongestionLevels.js and is left there
 * as the single source of truth, per MATCHING_PRICE.md's "Where the
 * Congestion Level Comes From". This engine only produces the status;
 * something downstream (the pricing bridge) is what consumes it.
 *
 * "Current load" comes from a LoadTracker instance (see LoadTracker.js),
 * which is fed by the trade lifecycle (BlockchainAdapter's trade records).
 */
class CongestionEngine {
  constructor({ loadTracker = new LoadTracker() } = {}) {
    this.loadTracker = loadTracker;
    this.zones = new Map(); // zoneId -> { capacityKwh, thresholdKwh, overrideLevel }
    this.auditLog = []; // every evaluate() call's inputs + result, for the same auditability reason as pricing rule 5
  }

  /** Define or update a zone's capacity and congestion threshold. */
  configureZone(zoneId, { capacityKwh, thresholdKwh }) {
    if (capacityKwh == null || thresholdKwh == null) {
      throw new Error('configureZone requires both capacityKwh and thresholdKwh');
    }
    if (Number(thresholdKwh) > Number(capacityKwh)) {
      throw new Error(`thresholdKwh (${thresholdKwh}) cannot exceed capacityKwh (${capacityKwh})`);
    }
    const existing = this.zones.get(zoneId);
    const zone = {
      zoneId,
      capacityKwh: Number(capacityKwh),
      thresholdKwh: Number(thresholdKwh),
      overrideLevel: existing ? existing.overrideLevel : null,
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
   * Hackathon-MVP escape hatch (see MATCHING_PRICE.md's "Hackathon-MVP
   * Note"): force a zone's status for a demo without wiring up real load,
   * e.g. to show the marketplace flipping to CONSTRAINED on cue. Clear with
   * clearOverride(). A real evaluate() call still runs underneath and is
   * still logged — only the returned congestionLevel is swapped.
   */
  setOverride(zoneId, level) {
    const zone = this.getZoneConfig(zoneId);
    if (!['NORMAL', 'ELEVATED', 'CONSTRAINED'].includes(level)) {
      throw new Error(`Unknown override level '${level}'`);
    }
    zone.overrideLevel = level;
    return { ...zone };
  }

  clearOverride(zoneId) {
    const zone = this.getZoneConfig(zoneId);
    zone.overrideLevel = null;
    return { ...zone };
  }

  _classify(projectedLoadKwh, zone) {
    if (projectedLoadKwh >= zone.capacityKwh) return 'CONSTRAINED';
    if (projectedLoadKwh >= zone.thresholdKwh) return 'ELEVATED';
    return 'NORMAL';
  }

  /**
   * evaluate — the main entry point. additionalKwh lets a caller ask "what
   * would the status be if this much more load were added?" without
   * actually reserving anything (see checkNewTrade below, and
   * MATCHING_PRICE.md's projected-load requirement: a burst of orders in
   * the same tick must each be checked against current + their own
   * quantity, not against a stale current-load snapshot).
   */
  evaluate(zoneId, { additionalKwh = 0 } = {}) {
    const zone = this.getZoneConfig(zoneId);
    const currentLoadKwh = this.loadTracker.getCurrentLoad(zoneId);
    const projectedLoadKwh = Number((currentLoadKwh + additionalKwh).toFixed(4));
    const computedLevel = this._classify(projectedLoadKwh, zone);
    const congestionLevel = zone.overrideLevel || computedLevel;

    const result = {
      zoneId,
      timestamp: new Date().toISOString(),
      capacityKwh: zone.capacityKwh,
      thresholdKwh: zone.thresholdKwh,
      currentLoadKwh,
      additionalKwh,
      projectedLoadKwh,
      computedLevel,
      congestionLevel, // what callers should actually use — may reflect an override
      overridden: congestionLevel !== computedLevel,
      activeTradeCount: this.loadTracker.getActiveTradeCount(zoneId),
    };

    this.auditLog.push(result);
    return result;
  }

  /**
   * checkNewTrade — convenience wrapper for the matching engine's
   * pre-match congestion gate (MATCHING_PRICE.md): evaluate what the zone's
   * status would become if this order's quantity were added on top of
   * current load, WITHOUT committing it. The matching engine (or the
   * pricing bridge) still needs CongestionLevels.getCongestionLevel() to
   * turn the returned congestionLevel into a tradeAllowed boolean.
   */
  checkNewTrade(zoneId, requestedQuantityKwh) {
    if (requestedQuantityKwh == null || requestedQuantityKwh < 0) {
      throw new Error('checkNewTrade requires a non-negative requestedQuantityKwh');
    }
    return this.evaluate(zoneId, { additionalKwh: requestedQuantityKwh });
  }

  getAuditLog(zoneId) {
    if (!zoneId) return [...this.auditLog];
    return this.auditLog.filter((r) => r.zoneId === zoneId);
  }
}

module.exports = CongestionEngine;
