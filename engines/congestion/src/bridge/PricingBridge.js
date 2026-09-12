/**
 * PricingBridge
 *
 * Closes the loop described in MATCHING_PRICE.md's "Where the Congestion
 * Level Comes From": CongestionEngine decides NORMAL/ELEVATED/CONSTRAINED,
 * but that string is useless until it reaches PricingEngine.computeQuote()
 * (via PricingScheduler.pushInputs, per pricing-engine's own README: "feed
 * congestionLevel from a congestion engine... this engine only consumes the
 * level, it doesn't decide it").
 *
 * Dependencies are injected rather than require()'d directly, the same way
 * PricingEngine takes its formulas as constructor args — this repo doesn't
 * assume it sits at any particular relative path next to
 * solarlink-pricing-engine, and it makes the bridge trivially testable with
 * fakes (see test/demo.js).
 *
 * Expected shapes (structural, not literal imports):
 *   congestionEngine — CongestionEngine instance (this repo's)
 *   pricingScheduler — { pushInputs(zoneId, inputs) } (solarlink-pricing-engine's PricingScheduler)
 *   resolveTradeAllowed(congestionLevel) -> boolean, e.g.
 *     (level) => require('.../CongestionLevels').getCongestionLevel(level).tradeAllowed
 *     Optional — only needed for precheckTrade's early-exit convenience.
 */
class PricingBridge {
  constructor({ congestionEngine, pricingScheduler, resolveTradeAllowed = null }) {
    if (!congestionEngine || !pricingScheduler) {
      throw new Error('PricingBridge requires congestionEngine and pricingScheduler');
    }
    this.congestionEngine = congestionEngine;
    this.pricingScheduler = pricingScheduler;
    this.resolveTradeAllowed = resolveTradeAllowed;
  }

  /**
   * syncZone — call whenever supply/demand data changes (e.g. a new meter
   * reading) or on a timer, same cadence PricingScheduler already expects
   * out-of-band inputs on. Evaluates current congestion (no additional
   * load) and pushes the result into pricing.
   */
  syncZone(zoneId, { supplyKwh, demandKwh }) {
    const congestion = this.congestionEngine.evaluate(zoneId);
    const pushResult = this.pricingScheduler.pushInputs(zoneId, {
      supplyKwh,
      demandKwh,
      congestionLevel: congestion.congestionLevel,
    });
    return { congestion, pricing: pushResult };
  }

  /**
   * precheckTrade — the matching engine's pre-match gate from
   * MATCHING_PRICE.md: "load must be evaluated per candidate order, before
   * matching commits it." Projects the order's quantity onto current load
   * WITHOUT reserving anything, and (if resolveTradeAllowed was provided)
   * tells the caller up front whether the resulting level would block the
   * trade — so the matching engine can reject with ZONE_CONGESTED before
   * ever touching a listing.
   *
   * This does NOT push into pricing and does NOT reserve load — it's a
   * read-only "what if" check. The matching engine still reserves load via
   * LoadTracker.sync()/reserve() only once it actually creates the trade.
   */
  precheckTrade(zoneId, requestedQuantityKwh) {
    const congestion = this.congestionEngine.checkNewTrade(zoneId, requestedQuantityKwh);
    const wouldAllow = this.resolveTradeAllowed ? this.resolveTradeAllowed(congestion.congestionLevel) : null;
    return { ...congestion, wouldAllow };
  }
}

module.exports = PricingBridge;
