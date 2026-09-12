const { getScenario } = require('./scenarios');

function round(n, dp = 3) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function randomNoise(spread) {
  return (Math.random() * 2 - 1) * spread;
}

/**
 * Bell-shaped daylight factor, 0 outside sunrise/sunset, peaking at solar
 * noon. `hourFraction` is e.g. 13.5 for 13:30.
 */
function daylightFactor(hourFraction, sunrise = 6, sunset = 19) {
  if (hourFraction <= sunrise || hourFraction >= sunset) return 0;
  const span = sunset - sunrise;
  return Math.max(0, Math.sin((Math.PI * (hourFraction - sunrise)) / span));
}

/**
 * Household consumption baseline: a small constant base load plus morning
 * and evening peaks (gaussian bumps), independent of solar generation.
 */
function consumptionFactor(hourFraction) {
  const base = 0.25;
  const morningPeak = 0.7 * Math.exp(-((hourFraction - 8) ** 2) / (2 * 1.2 ** 2));
  const eveningPeak = 1.0 * Math.exp(-((hourFraction - 19.5) ** 2) / (2 * 1.5 ** 2));
  return base + morningPeak + eveningPeak;
}

/**
 * MeterSimulator — one simulated smart meter for one asset (a prosumer's
 * rooftop installation, or a consumer-only household meter).
 *
 * type: 'PROSUMER' (has generation) | 'CONSUMER' (consumption only)
 */
class MeterSimulator {
  constructor({
    assetId,
    zoneId,
    type = 'PROSUMER',
    capacityKw = 5, // installed panel capacity, only relevant for PROSUMER
    consumptionScale = 1.0, // household size multiplier for baseline consumption
    hasBattery = false,
    batteryCapacityKwh = 0,
    batteryPriority = 'charge_first', // 'charge_first' | 'sell_first'
    intervalMinutes = 5,
  }) {
    if (!assetId) throw new Error('MeterSimulator requires an assetId');
    this.assetId = assetId;
    this.zoneId = zoneId ?? null;
    this.type = type;
    this.capacityKw = capacityKw;
    this.consumptionScale = consumptionScale;
    this.hasBattery = hasBattery;
    this.batteryCapacityKwh = hasBattery ? batteryCapacityKwh : 0;
    this.batteryPriority = batteryPriority;
    this.intervalMinutes = intervalMinutes;

    this.batteryChargeKwh = 0;
    this.scenario = getScenario('NORMAL');
    this.readings = [];
    this.maxHistory = 500;
  }

  setScenario(scenarioKey) {
    this.scenario = getScenario(scenarioKey);
    return this.scenario;
  }

  /**
   * Produce one reading for the given moment (defaults to now). This is the
   * core of the simulator — everything else (manager, server) just calls
   * this on a timer or on demand.
   */
  tick(at = new Date()) {
    const hourFraction = at.getHours() + at.getMinutes() / 60;
    // Scaled so a default 5-minute tick lands in the same kWh-per-reading
    // ballpark as the worked example in IOT_METER.md (e.g. "3.2 kWh" per
    // reading), rather than doing strict kW-to-kWh energy integration —
    // this is a demo simulator, not a physical model.
    const intervalScale = this.intervalMinutes / 5;

    let generationKwh = 0;
    if (this.type === 'PROSUMER') {
      const dayFactor = daylightFactor(hourFraction);
      const raw = this.capacityKw * dayFactor * this.scenario.generationMultiplier * intervalScale;
      generationKwh = round(Math.max(0, raw + randomNoise(0.05 * this.capacityKw * intervalScale)));
    }

    const consumptionBase =
      1.5 * this.consumptionScale * consumptionFactor(hourFraction) * this.scenario.consumptionMultiplier * intervalScale;
    const consumptionKwh = round(Math.max(0.01, consumptionBase + randomNoise(0.03 * this.consumptionScale * intervalScale)));

    const rawSurplusKwh = round(generationKwh - consumptionKwh);

    // Battery interaction (design doc: "reserve battery energy according to
    // configured priority").
    let sellableSurplusKwh = rawSurplusKwh;
    let batteryDeltaKwh = 0;
    if (this.hasBattery && this.batteryCapacityKwh > 0) {
      if (rawSurplusKwh > 0 && this.batteryPriority === 'charge_first') {
        const room = this.batteryCapacityKwh - this.batteryChargeKwh;
        const toCharge = Math.min(rawSurplusKwh, Math.max(0, room));
        this.batteryChargeKwh = round(this.batteryChargeKwh + toCharge);
        sellableSurplusKwh = round(rawSurplusKwh - toCharge);
        batteryDeltaKwh = round(toCharge);
      } else if (rawSurplusKwh < 0) {
        // deficit: draw from battery before assuming grid/market purchase
        const deficit = -rawSurplusKwh;
        const toDischarge = Math.min(deficit, this.batteryChargeKwh);
        this.batteryChargeKwh = round(this.batteryChargeKwh - toDischarge);
        sellableSurplusKwh = round(rawSurplusKwh + toDischarge); // still <= 0 unless fully covered
        batteryDeltaKwh = round(-toDischarge);
      }
      // 'sell_first' priority: list all surplus, battery untouched by surplus
    }

    const reading = {
      assetId: this.assetId,
      zoneId: this.zoneId,
      type: this.type,
      timestamp: at.toISOString(),
      generationKwh,
      consumptionKwh,
      surplusKwh: rawSurplusKwh,
      sellableSurplusKwh,
      batteryChargeKwh: this.hasBattery ? this.batteryChargeKwh : null,
      batteryDeltaKwh: this.hasBattery ? batteryDeltaKwh : null,
      scenario: this.scenario.key,
    };

    this.readings.push(reading);
    if (this.readings.length > this.maxHistory) this.readings.shift();

    return reading;
  }

  latest() {
    return this.readings[this.readings.length - 1] || null;
  }

  history(limit) {
    if (!limit) return [...this.readings];
    return this.readings.slice(-limit);
  }

  /**
   * getDeliveredKwh — used at trade-delivery time, not on every tick. Given
   * a contracted quantity for a specific trade, returns what this meter
   * "actually delivered", applying the DELIVERY_SHORTFALL scenario if
   * active. This is what gets passed to BlockchainAdapter.recordDelivery().
   */
  getDeliveredKwh(committedKwh) {
    const shortfall = this.scenario.shortfallPercent || 0;
    const delivered = committedKwh * (1 - shortfall);
    return round(Math.max(0, delivered));
  }
}

module.exports = MeterSimulator;
