const crypto = require('crypto');
const HashChainLedger = require('../ledger/HashChainLedger');
const { TradeStatus, assertTransition } = require('../state/TradeStateMachine');

/**
 * Roles, per BLOCKCHAIN_DESIGN.md §10. Not every wallet/actor can call every
 * function — Member 1's backend should pass the correct role in based on the
 * authenticated caller (regulator = read-only, meter verifier only records
 * delivery, etc).
 */
const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  TRADING_ENGINE: 'TRADING_ENGINE',
  SETTLEMENT_ENGINE: 'SETTLEMENT_ENGINE',
  METER_VERIFIER: 'METER_VERIFIER',
  REGULATOR: 'REGULATOR',
});

/**
 * BlockchainAdapter
 *
 * This is the ONLY thing the rest of the backend (Member 1's trade APIs)
 * should talk to. Internally it currently uses HashChainLedger, but the
 * interface (createTrade / lockTrade / recordDelivery / settleTrade /
 * raiseDispute / getTradeHistory) is written so it can be backed by
 * SolidityAdapter instead without changing any calling code — see
 * BLOCKCHAIN_DESIGN.md §5 and §16.
 *
 * It does NOT calculate pricing, matching, or surplus — see design doc §11/12.
 * It only records the result of those decisions and enforces that trade
 * state transitions happen in the right order.
 */
class BlockchainAdapter {
  /**
   * @param {object} opts
   * @param {number} opts.disputeTolerancePercent Shortfall % above which a
   *   delivery auto-moves the trade to DISPUTED instead of VERIFIED
   *   (design doc §13/§20 — configured in "Smart Contract / Trading Rule Setup").
   */
  constructor({ disputeTolerancePercent = 10 } = {}) {
    this.ledger = new HashChainLedger();
    this.trades = new Map(); // tradeId -> trade record (mirrors the on-chain Trade struct)
    this.disputeTolerancePercent = disputeTolerancePercent;
  }

  _requireRole(actorRole, allowedRoles, action) {
    if (!allowedRoles.includes(actorRole)) {
      const err = new Error(
        `Role '${actorRole}' is not authorized to call ${action}. Allowed roles: ${allowedRoles.join(', ')}`
      );
      err.code = 'UNAUTHORIZED';
      throw err;
    }
  }

  _getTradeOrThrow(tradeId) {
    const trade = this.trades.get(tradeId);
    if (!trade) {
      const err = new Error(`Trade ${tradeId} does not exist`);
      err.code = 'TRADE_NOT_FOUND';
      throw err;
    }
    return trade;
  }

  /**
   * createTrade — called once the matching engine (Member 2) has picked a
   * buyer/seller and Member 1's backend is ready to persist the match.
   */
  createTrade(trade, actorRole = ROLES.TRADING_ENGINE) {
    this._requireRole(actorRole, [ROLES.TRADING_ENGINE, ROLES.ADMIN], 'createTrade');
    const { tradeId, buyer, seller, zoneId, quantityKwh, agreedPrice } = trade;

    if (this.trades.has(tradeId)) {
      const err = new Error(`Trade ${tradeId} already exists — duplicate trade rejected`);
      err.code = 'DUPLICATE_TRADE';
      throw err;
    }
    if (!tradeId || !buyer || !seller || !quantityKwh || !agreedPrice) {
      throw new Error('createTrade requires tradeId, buyer, seller, quantityKwh, agreedPrice');
    }

    const totalAmount = Number((quantityKwh * agreedPrice).toFixed(4));
    const record = {
      tradeId,
      buyer,
      seller,
      zoneId: zoneId ?? null,
      quantityKwh,
      agreedPrice,
      totalAmount,
      status: TradeStatus.MATCHED,
      createdAt: new Date().toISOString(),
      delivery: null,
      dispute: null,
      settlement: null,
    };
    this.trades.set(tradeId, record);

    const event = this.ledger.addEvent(tradeId, 'TradeCreated', {
      buyer,
      seller,
      zoneId: record.zoneId,
      quantityKwh,
      agreedPrice,
      totalAmount,
    });
    return { trade: { ...record }, event };
  }

  /** lockTrade — reserves the trade before delivery begins. */
  lockTrade(tradeId, actorRole = ROLES.TRADING_ENGINE) {
    this._requireRole(actorRole, [ROLES.TRADING_ENGINE, ROLES.ADMIN], 'lockTrade');
    const trade = this._getTradeOrThrow(tradeId);
    assertTransition(trade.status, TradeStatus.LOCKED);
    trade.status = TradeStatus.LOCKED;
    const event = this.ledger.addEvent(tradeId, 'TradeLocked', {});
    return { trade: { ...trade }, event };
  }

  /**
   * cancelTrade — e.g. a congestion signal pauses the zone before delivery.
   * Design doc §19: a paused trade should never be locked/settled on-chain;
   * this records the cancellation itself as an auditable event instead.
   */
  cancelTrade(tradeId, reason = '', actorRole = ROLES.TRADING_ENGINE) {
    this._requireRole(actorRole, [ROLES.TRADING_ENGINE, ROLES.ADMIN], 'cancelTrade');
    const trade = this._getTradeOrThrow(tradeId);
    assertTransition(trade.status, TradeStatus.CANCELLED);
    trade.status = TradeStatus.CANCELLED;
    const event = this.ledger.addEvent(tradeId, 'TradeCancelled', { reason });
    return { trade: { ...trade }, event };
  }

  /**
   * recordDelivery — Member 1's backend calls this after Member 2's IoT
   * pipeline reports delivered kWh. Raw meter readings stay off-chain
   * (design doc §13/§21); only a hash of them is recorded. This also
   * auto-decides VERIFIED vs DISPUTED based on shortfall tolerance, so the
   * caller doesn't need a separate verifyDelivery() call.
   */
  recordDelivery(tradeId, { deliveredKwh, meterReadings = [] }, actorRole = ROLES.METER_VERIFIER) {
    this._requireRole(actorRole, [ROLES.METER_VERIFIER, ROLES.ADMIN], 'recordDelivery');
    const trade = this._getTradeOrThrow(tradeId);
    assertTransition(trade.status, TradeStatus.DELIVERED);

    const meterDataHash = crypto.createHash('sha256').update(JSON.stringify(meterReadings)).digest('hex');
    trade.status = TradeStatus.DELIVERED;
    trade.delivery = { deliveredKwh, meterDataHash, recordedAt: new Date().toISOString() };

    const deliveredEvent = this.ledger.addEvent(tradeId, 'DeliveryRecorded', {
      deliveredKwh,
      meterDataHash,
    });

    const shortfallPercent = Number((((trade.quantityKwh - deliveredKwh) / trade.quantityKwh) * 100).toFixed(2));
    let secondEvent;
    if (shortfallPercent > this.disputeTolerancePercent) {
      assertTransition(trade.status, TradeStatus.DISPUTED);
      trade.status = TradeStatus.DISPUTED;
      trade.dispute = {
        shortfallPercent,
        tolerancePercent: this.disputeTolerancePercent,
        raisedAt: new Date().toISOString(),
      };
      secondEvent = this.ledger.addEvent(tradeId, 'DisputeRaised', {
        contractedKwh: trade.quantityKwh,
        deliveredKwh,
        shortfallPercent,
        tolerancePercent: this.disputeTolerancePercent,
      });
    } else {
      assertTransition(trade.status, TradeStatus.VERIFIED);
      trade.status = TradeStatus.VERIFIED;
      secondEvent = this.ledger.addEvent(tradeId, 'TradeVerified', {
        contractedKwh: trade.quantityKwh,
        deliveredKwh,
        shortfallPercent,
      });
    }

    return { trade: { ...trade }, events: [deliveredEvent, secondEvent] };
  }

  /**
   * resolveDispute — applies the refund/credit decided by the dispute rule
   * engine (design doc §20) and records it before settlement.
   */
  resolveDispute(tradeId, { refundAmount = 0, resolutionNote = '' } = {}, actorRole = ROLES.ADMIN) {
    this._requireRole(actorRole, [ROLES.ADMIN, ROLES.SETTLEMENT_ENGINE], 'resolveDispute');
    const trade = this._getTradeOrThrow(tradeId);
    if (trade.status !== TradeStatus.DISPUTED) {
      throw new Error(`Trade ${tradeId} is not in DISPUTED state (currently ${trade.status})`);
    }
    trade.dispute.refundAmount = refundAmount;
    trade.dispute.resolutionNote = resolutionNote;
    trade.dispute.resolvedAt = new Date().toISOString();
    const event = this.ledger.addEvent(tradeId, 'DisputeResolved', { refundAmount, resolutionNote });
    return { trade: { ...trade }, event };
  }

  /** settleTrade — finalizes payment; rejects any second attempt. */
  settleTrade(tradeId, actorRole = ROLES.SETTLEMENT_ENGINE) {
    this._requireRole(actorRole, [ROLES.SETTLEMENT_ENGINE, ROLES.ADMIN], 'settleTrade');
    const trade = this._getTradeOrThrow(tradeId);

    if (trade.status === TradeStatus.SETTLED) {
      const err = new Error(`Trade ${tradeId} is already settled — duplicate settlement rejected`);
      err.code = 'DUPLICATE_SETTLEMENT';
      throw err;
    }
    assertTransition(trade.status, TradeStatus.SETTLED);

    const refund = (trade.dispute && trade.dispute.refundAmount) || 0;
    const finalAmount = Number((trade.totalAmount - refund).toFixed(4));

    trade.status = TradeStatus.SETTLED;
    trade.settlement = { finalAmount, refund, settledAt: new Date().toISOString() };

    const event = this.ledger.addEvent(tradeId, 'TradeSettled', { finalAmount, refund });
    return { trade: { ...trade }, event };
  }

  // ---- read-only helpers (safe for REGULATOR role) ----

  getTrade(tradeId) {
    return { ...this._getTradeOrThrow(tradeId) };
  }

  listTrades() {
    return Array.from(this.trades.values()).map((t) => ({ ...t }));
  }

  getTradeHistory(tradeId) {
    return this.ledger.getHistory(tradeId);
  }

  getFullLedger() {
    return this.ledger.getFullChain();
  }

  verifyLedgerIntegrity() {
    return this.ledger.verifyChain();
  }
}

module.exports = { BlockchainAdapter, ROLES, TradeStatus };
