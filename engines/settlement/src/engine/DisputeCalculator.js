const { round } = require('./feeFormulas');

/**
 * DisputeCalculator
 *
 * Implements SETTLEMENT_DISPUTE.md's dispute half exactly:
 *
 *   shortfall_percent = ((contracted - delivered) / contracted) × 100
 *   if shortfall_percent > tolerance -> disputed
 *
 * This is deliberately independent of any particular blockchain adapter —
 * solarlink-blockchain's BlockchainAdapter.recordDelivery() already computes
 * an equivalent shortfallPercent internally and uses it to move a trade to
 * VERIFIED or DISPUTED. This module exists so:
 *   (a) the formula is documented and testable on its own, and
 *   (b) SettlementEngine can be handed a shortfall percent from *any* source
 *       (a live adapter, a replayed trade record, a unit test) without
 *       requiring a real BlockchainAdapter instance.
 *
 * If you already have an adapter's trade record with `dispute.shortfallPercent`
 * set, you can skip this and pass that number straight into
 * SettlementEngine.computeSettlement() — this is provided for callers that
 * don't.
 */
function evaluateShortfall({ contractedKwh, deliveredKwh, tolerancePercent = 10 }) {
  if (!contractedKwh || contractedKwh <= 0) {
    throw new Error('evaluateShortfall requires a positive contractedKwh');
  }
  if (deliveredKwh == null || deliveredKwh < 0) {
    throw new Error('evaluateShortfall requires a non-negative deliveredKwh');
  }

  const shortfallPercent = round((((contractedKwh - deliveredKwh) / contractedKwh) * 100), 2);
  const isDisputed = shortfallPercent > tolerancePercent;

  return {
    contractedKwh,
    deliveredKwh,
    tolerancePercent,
    shortfallPercent,
    isDisputed,
    status: isDisputed ? 'DISPUTED' : 'VERIFIED',
  };
}

module.exports = { evaluateShortfall };
