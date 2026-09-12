/**
 * Formulas are plain functions passed into PricingEngine's constructor
 * (with these as defaults), per DYNAMIC_PRICING.md: "The exact formula
 * should be configurable rather than hardcoded." Swap either one out for a
 * different model without touching PricingEngine itself.
 */

function clamp(value, floor, ceiling) {
  return Math.min(ceiling, Math.max(floor, value));
}

/**
 * demand_ratio = demand / max(supply, epsilon)
 * Returned as (ratio - 1) so it's centered on 0 at perfect balance:
 * negative when supply > demand (pushes toward floor), positive when
 * demand > supply (pushes toward ceiling).
 */
function defaultDemandPressure({ supplyKwh, demandKwh }, epsilon = 0.001) {
  const demandRatio = demandKwh / Math.max(supplyKwh, epsilon);
  return demandRatio - 1;
}

/**
 * market_price = floor + elasticity_factor × demand_pressure
 */
function defaultMarketPriceFormula({ floor, elasticityFactor, demandPressure }) {
  return floor + elasticityFactor * demandPressure;
}

module.exports = { clamp, defaultDemandPressure, defaultMarketPriceFormula };
