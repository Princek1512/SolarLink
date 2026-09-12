/**
 * Congestion levels, matching the B7/Grid-Congestion screen described in
 * the problem statement (Normal / Elevated / Constrained) and rule 4 in
 * DYNAMIC_PRICING.md: "Congestion can affect both price and trade
 * eligibility."
 *
 * surchargePerKwh is the `congestion_adjustment` term added before the
 * final clamp. tradeAllowed = false means CONSTRAINED zones should have new
 * trades paused upstream (matching engine / blockchain adapter's
 * cancelTrade) even though a price can still be quoted for display.
 */
const DEFAULT_CONGESTION_LEVELS = Object.freeze({
  NORMAL: { key: 'NORMAL', surchargePerKwh: 0, tradeAllowed: true },
  ELEVATED: { key: 'ELEVATED', surchargePerKwh: 0.5, tradeAllowed: true },
  CONSTRAINED: { key: 'CONSTRAINED', surchargePerKwh: 1.5, tradeAllowed: false },
});

/**
 * Resolve a congestion level by key, allowing a zone to override the
 * default surcharge/tradeAllowed values (e.g. a zone with tighter physical
 * limits might want a bigger CONSTRAINED surcharge).
 */
function getCongestionLevel(levelKey, overrides = {}) {
  const base = DEFAULT_CONGESTION_LEVELS[levelKey];
  if (!base) {
    const valid = Object.keys(DEFAULT_CONGESTION_LEVELS).join(', ');
    throw new Error(`Unknown congestion level '${levelKey}'. Valid levels: ${valid}`);
  }
  return { ...base, ...(overrides[levelKey] || {}) };
}

module.exports = { DEFAULT_CONGESTION_LEVELS, getCongestionLevel };
