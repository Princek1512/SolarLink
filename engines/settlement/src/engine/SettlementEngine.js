const {
  round,
  defaultPlatformFeeFormula,
  defaultGridFeeFormula,
  defaultRefundFormula,
} = require('./feeFormulas');
const { evaluateShortfall } = require('./DisputeCalculator');

const DEFAULT_ZONE = '_default';

/**
 * SettlementEngine
 *
 * Implements SETTLEMENT_DISPUTE.md's settlement half end to end:
 *
 *   gross            = quantity × agreed_price
 *   platform_fee     = gross × platform_fee_percent
 *   grid_fee         = gross × grid_fee_percent
 *   prosumer_credit  = gross - fees - refund
 *   consumer_debit   = gross - refund
 *
 * `quantity` here is the CONTRACTED quantity from the trade (what the buyer
 * agreed to pay for), not the delivered quantity — this matches
 * BlockchainAdapter.createTrade's `totalAmount = quantityKwh × agreedPrice`,
 * so `gross` computed here is always identical to that `totalAmount` for
 * the same trade. Fees are charged on that original gross regardless of any
 * shortfall; only the refund (and therefore prosumer_credit/consumer_debit)
 * moves with delivery performance. That's a direct reading of the doc's own
 * formulas (fees only reference `gross`, never `delivered`).
 *
 * Note the identity this produces: prosumer_credit = consumer_debit - fees.
 * The consumer's debit and the prosumer's credit differ by exactly the fees
 * taken out — useful as a sanity check when wiring up real wallets.
 *
 * Fee percentages and the refund rule are all injectable (formulas +
 * per-zone overrides), the same "configurable, not hardcoded" convention as
 * solarlink-pricing-engine.
 */
class SettlementEngine {
  constructor({
    platformFeePercent = 0.02,
    gridFeePercent = 0.01,
    platformFeeFormula = defaultPlatformFeeFormula,
    gridFeeFormula = defaultGridFeeFormula,
    refundFormula = defaultRefundFormula,
  } = {}) {
    this.defaultFees = { platformFeePercent: Number(platformFeePercent), gridFeePercent: Number(gridFeePercent) };
    this.zoneFees = new Map(); // zoneId -> { platformFeePercent, gridFeePercent } override
    this.platformFeeFormula = platformFeeFormula;
    this.gridFeeFormula = gridFeeFormula;
    this.refundFormula = refundFormula;
    this.auditLog = []; // every computeSettlement() call's inputs + result, for the same auditability reason as pricing rule 5
  }

  /** Override platform/grid fee percentages for one zone. Falls back to the
   * engine's defaults for any field not provided. */
  configureZoneFees(zoneId, { platformFeePercent, gridFeePercent } = {}) {
    const existing = this.zoneFees.get(zoneId) || {};
    const fees = {
      platformFeePercent: platformFeePercent != null ? Number(platformFeePercent) : (existing.platformFeePercent ?? this.defaultFees.platformFeePercent),
      gridFeePercent: gridFeePercent != null ? Number(gridFeePercent) : (existing.gridFeePercent ?? this.defaultFees.gridFeePercent),
    };
    this.zoneFees.set(zoneId, fees);
    return { zoneId, ...fees };
  }

  _feesFor(zoneId) {
    return this.zoneFees.get(zoneId) || this.zoneFees.get(DEFAULT_ZONE) || this.defaultFees;
  }

  /**
   * computeSettlement — the main entry point. Pass either:
   *   - `shortfallPercent` directly (e.g. from an adapter trade's
   *     `dispute.shortfallPercent`, or a pre-computed value), or
   *   - `contractedKwh` + `deliveredKwh`, and this will run
   *     DisputeCalculator.evaluateShortfall() itself.
   * If neither is given, shortfall is assumed to be 0 (fully delivered,
   * no dispute) — useful for a straight-through VERIFIED settlement.
   */
  computeSettlement({
    tradeId,
    zoneId = DEFAULT_ZONE,
    quantityKwh,
    agreedPrice,
    contractedKwh,
    deliveredKwh,
    shortfallPercent,
    tolerancePercent = 10,
  }) {
    if (!tradeId || quantityKwh == null || agreedPrice == null) {
      throw new Error('computeSettlement requires tradeId, quantityKwh, and agreedPrice');
    }

    let shortfall = { shortfallPercent: 0, isDisputed: false, status: 'VERIFIED' };
    if (shortfallPercent != null) {
      shortfall = { shortfallPercent, isDisputed: shortfallPercent > tolerancePercent, status: shortfallPercent > tolerancePercent ? 'DISPUTED' : 'VERIFIED' };
    } else if (deliveredKwh != null) {
      shortfall = evaluateShortfall({ contractedKwh: contractedKwh ?? quantityKwh, deliveredKwh, tolerancePercent });
    }

    const gross = round(quantityKwh * agreedPrice);
    const fees = this._feesFor(zoneId);

    const platformFee = round(this.platformFeeFormula({ gross, platformFeePercent: fees.platformFeePercent }));
    const gridFee = round(this.gridFeeFormula({ gross, gridFeePercent: fees.gridFeePercent }));
    const totalFees = round(platformFee + gridFee);

    const refund = shortfall.isDisputed
      ? round(this.refundFormula({ gross, shortfallPercent: shortfall.shortfallPercent }))
      : 0;

    const prosumerCredit = round(gross - totalFees - refund);
    const consumerDebit = round(gross - refund);

    const result = {
      tradeId,
      zoneId,
      timestamp: new Date().toISOString(),
      quantityKwh,
      agreedPrice,
      gross,
      fees: { platformFeePercent: fees.platformFeePercent, gridFeePercent: fees.gridFeePercent, platformFee, gridFee, totalFees },
      shortfallPercent: shortfall.shortfallPercent,
      isDisputed: shortfall.isDisputed,
      status: shortfall.status,
      refund,
      prosumerCredit,
      consumerDebit,
    };

    this.auditLog.push(result);
    return result;
  }

  getAuditLog(tradeId) {
    if (!tradeId) return [...this.auditLog];
    return this.auditLog.filter((r) => r.tradeId === tradeId);
  }
}

module.exports = SettlementEngine;
