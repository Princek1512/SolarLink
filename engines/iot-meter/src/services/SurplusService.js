/**
 * SurplusService — the piece IOT_METER.md refers to as "the surplus service
 * uses the latest reading to update the energy listing." It doesn't decide
 * price (that's the pricing engine) or match buyers (that's the matching
 * engine) — it just turns "this meter currently has sellable surplus" into
 * a listing-shaped record the marketplace/backend can consume.
 */
class SurplusService {
  constructor(simulatorManager) {
    this.manager = simulatorManager;
  }

  /**
   * Current listable surplus for one meter, or null if it's a consumer
   * meter, has no reading yet, or currently has nothing to sell.
   */
  getListableSurplus(assetId) {
    const meter = this.manager.getMeter(assetId);
    if (meter.type !== 'PROSUMER') return null;
    const latest = meter.latest();
    if (!latest || latest.sellableSurplusKwh <= 0) return null;

    return {
      assetId: meter.assetId,
      zoneId: meter.zoneId,
      quantityAvailableKwh: latest.sellableSurplusKwh,
      asOf: latest.timestamp,
      scenario: latest.scenario,
    };
  }

  /** All current listable surplus across every registered prosumer meter. */
  getAllListableSurplus() {
    return this.manager
      .listMeters()
      .filter((m) => m.type === 'PROSUMER')
      .map((m) => this.getListableSurplus(m.assetId))
      .filter(Boolean);
  }

  /**
   * Zone-anonymized market view, matching the frontend spec's example
   * ("Zone 3 – 4.2 kWh available"). Aggregates by zone rather than exposing
   * individual assetIds, since the marketplace card hides seller identity.
   */
  getZoneSummaries() {
    const byZone = new Map();
    for (const listing of this.getAllListableSurplus()) {
      const key = listing.zoneId ?? 'UNASSIGNED';
      const existing = byZone.get(key) || {
        zoneId: key,
        totalAvailableKwh: 0,
        listingCount: 0,
        asOf: listing.asOf,
      };
      existing.totalAvailableKwh = Math.round((existing.totalAvailableKwh + listing.quantityAvailableKwh) * 1000) / 1000;
      existing.listingCount += 1;
      if (listing.asOf > existing.asOf) existing.asOf = listing.asOf;
      byZone.set(key, existing);
    }
    return Array.from(byZone.values());
  }
}

module.exports = SurplusService;
