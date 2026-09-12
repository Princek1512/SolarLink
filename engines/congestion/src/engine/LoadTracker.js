/**
 * LoadTracker
 *
 * CONGESTION_MANAGEMENT.md lists "Active trades" as an input to congestion
 * status but never defines what "active" means in terms of the actual trade
 * lifecycle. This ties it to solarlink-blockchain's TradeStateMachine:
 *
 *   MATCHED -> LOCKED -> DELIVERED -> VERIFIED -> SETTLED
 *                              \-> DISPUTED -> SETTLED
 *   (MATCHED | LOCKED) -> CANCELLED
 *
 * A trade occupies grid transmission capacity from the moment it's MATCHED
 * until the energy has actually moved (through DELIVERED). Once delivery has
 * happened, VERIFIED / DISPUTED / SETTLED are financial/dispute states —
 * the transmission window is over, so they no longer count as load.
 * CANCELLED never consumed capacity in the first place.
 *
 * This module does not know about prices, zones' capacity, or thresholds —
 * it only answers "how much committed load does zone X have right now?".
 * CongestionEngine.js is what turns that into a NORMAL/ELEVATED/CONSTRAINED
 * status.
 */

// Statuses that occupy grid capacity, per the reasoning above.
const ACTIVE_LOAD_STATUSES = Object.freeze(['MATCHED', 'LOCKED', 'DELIVERED']);

class LoadTracker {
  constructor() {
    this.zoneTrades = new Map(); // zoneId -> Map(tradeId -> quantityKwh)
  }

  _zoneMap(zoneId) {
    if (!this.zoneTrades.has(zoneId)) this.zoneTrades.set(zoneId, new Map());
    return this.zoneTrades.get(zoneId);
  }

  /**
   * sync — the single integration point. Call this with a trade record
   * shaped like BlockchainAdapter's trade (tradeId, zoneId, quantityKwh,
   * status) after every adapter call (createTrade, lockTrade, recordDelivery,
   * cancelTrade, settleTrade, resolveDispute all return { trade, ...}).
   * Idempotent: calling it repeatedly with the same trade/status is safe.
   */
  sync(trade) {
    const { tradeId, zoneId, quantityKwh, status } = trade;
    if (!tradeId || zoneId == null || quantityKwh == null || !status) {
      throw new Error('LoadTracker.sync requires tradeId, zoneId, quantityKwh, and status');
    }
    const zone = this._zoneMap(zoneId);
    if (ACTIVE_LOAD_STATUSES.includes(status)) {
      zone.set(tradeId, quantityKwh);
    } else {
      zone.delete(tradeId);
    }
    return this.getCurrentLoad(zoneId);
  }

  /** Explicit reserve, for callers that don't have a full trade record yet
   * (e.g. the matching engine reserving a listing before a trade exists). */
  reserve(zoneId, tradeId, quantityKwh) {
    if (quantityKwh == null || quantityKwh < 0) {
      throw new Error('reserve requires a non-negative quantityKwh');
    }
    this._zoneMap(zoneId).set(tradeId, quantityKwh);
    return this.getCurrentLoad(zoneId);
  }

  /** Explicit release — call when a trade settles, is cancelled, or a
   * reservation is abandoned. */
  release(zoneId, tradeId) {
    const zone = this.zoneTrades.get(zoneId);
    if (zone) zone.delete(tradeId);
    return this.getCurrentLoad(zoneId);
  }

  getCurrentLoad(zoneId) {
    const zone = this.zoneTrades.get(zoneId);
    if (!zone) return 0;
    let total = 0;
    for (const qty of zone.values()) total += qty;
    return Number(total.toFixed(4));
  }

  getActiveTradeCount(zoneId) {
    const zone = this.zoneTrades.get(zoneId);
    return zone ? zone.size : 0;
  }

  listActiveTrades(zoneId) {
    const zone = this.zoneTrades.get(zoneId);
    if (!zone) return [];
    return Array.from(zone.entries()).map(([tradeId, quantityKwh]) => ({ tradeId, quantityKwh }));
  }
}

module.exports = { LoadTracker, ACTIVE_LOAD_STATUSES };
