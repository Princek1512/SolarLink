/**
 * Formulas are plain functions passed into SettlementEngine's constructor
 * (with these as defaults) — same "configurable, not hardcoded" convention
 * as solarlink-pricing-engine's formulas.js. SETTLEMENT_DISPUTE.md gives the
 * fee formulas explicitly but leaves the refund rule as "Calculate
 * refund/credit" with no specific formula (BLOCKCHAIN_DESIGN.md §20 shows a
 * worked example — 20% shortfall — but doesn't pin down the rule either),
 * so the refund formula is the one piece here that's a design decision
 * rather than a direct transcription of the doc.
 */

function round(n, dp = 4) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** platform_fee = gross × platform_fee_percent */
function defaultPlatformFeeFormula({ gross, platformFeePercent }) {
  return gross * platformFeePercent;
}

/** grid_fee = gross × grid_fee_percent */
function defaultGridFeeFormula({ gross, gridFeePercent }) {
  return gross * gridFeePercent;
}

/**
 * Default refund rule: proportional to shortfall — the buyer is refunded
 * the same fraction of gross as the fraction of energy that wasn't
 * delivered. This matches BLOCKCHAIN_DESIGN.md §20's example in spirit
 * (bigger shortfall -> bigger refund) without hardcoding its exact numbers.
 * Swap this out per-instance for a different policy (e.g. a fixed penalty,
 * or tiered refund bands) without touching SettlementEngine itself.
 */
function defaultRefundFormula({ gross, shortfallPercent }) {
  return clamp(gross * (shortfallPercent / 100), 0, gross);
}

module.exports = { round, clamp, defaultPlatformFeeFormula, defaultGridFeeFormula, defaultRefundFormula };
