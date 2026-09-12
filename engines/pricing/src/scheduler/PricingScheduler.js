/**
 * PricingScheduler — rule 3: "Recalculate at configured intervals or when
 * major market inputs change." Two independent mechanisms:
 *
 *  - start(zoneId, getInputs): re-quotes every zone.repricingIntervalMs
 *    using whatever getInputs() returns at that moment (a callback into
 *    live supply/demand/congestion data — the meter simulator's
 *    SurplusService, a congestion feed, etc).
 *
 *  - pushInputs(zoneId, inputs): call this immediately whenever new
 *    supply/demand data arrives out of band. If the change vs the last
 *    quoted inputs exceeds changeThresholdPercent (or congestion level
 *    changed at all), it recomputes right away instead of waiting for the
 *    next interval tick.
 */
class PricingScheduler {
  constructor(engine, { changeThresholdPercent = 15 } = {}) {
    this.engine = engine;
    this.timers = new Map(); // zoneId -> interval handle
    this.lastInputs = new Map(); // zoneId -> last inputs used for a quote
    this.changeThresholdPercent = changeThresholdPercent;
  }

  start(zoneId, getInputs) {
    if (this.timers.has(zoneId)) return; // already running
    const zone = this.engine.getZoneConfig(zoneId);

    const tick = () => {
      const inputs = getInputs();
      const quote = this.engine.computeQuote(zoneId, inputs);
      this.lastInputs.set(zoneId, inputs);
      return quote;
    };

    tick(); // quote immediately, then on the configured cadence
    const handle = setInterval(tick, zone.repricingIntervalMs);
    this.timers.set(zoneId, handle);
  }

  stop(zoneId) {
    const handle = this.timers.get(zoneId);
    if (handle) {
      clearInterval(handle);
      this.timers.delete(zoneId);
    }
  }

  stopAll() {
    for (const zoneId of this.timers.keys()) this.stop(zoneId);
  }

  _percentChange(prev, curr) {
    if (prev == null) return Infinity;
    if (prev === 0) return curr === 0 ? 0 : Infinity;
    return Math.abs((curr - prev) / prev) * 100;
  }

  /**
   * Call whenever fresh supply/demand/congestion data shows up out of band
   * (e.g. a new meter reading just changed available surplus). Returns
   * whether it actually triggered a recompute or deferred to the next
   * scheduled tick.
   */
  pushInputs(zoneId, inputs) {
    const prev = this.lastInputs.get(zoneId);
    const isMajorChange =
      !prev ||
      this._percentChange(prev.supplyKwh, inputs.supplyKwh) > this.changeThresholdPercent ||
      this._percentChange(prev.demandKwh, inputs.demandKwh) > this.changeThresholdPercent ||
      prev.congestionLevel !== inputs.congestionLevel;

    if (isMajorChange) {
      const quote = this.engine.computeQuote(zoneId, inputs);
      this.lastInputs.set(zoneId, inputs);
      return { recomputed: true, reason: 'major_input_change', quote };
    }
    return { recomputed: false, reason: 'within_threshold', quote: this.engine.getLastQuote(zoneId) };
  }
}

module.exports = PricingScheduler;
