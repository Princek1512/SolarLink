const http = require('http');
const https = require('https');
const { URL } = require('url');
const MeterSimulator = require('./MeterSimulator');

function postJson(urlString, body) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (err) {
      return reject(err);
    }
    const client = url.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = client.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * SimulatorManager
 *
 * Registry of meters + the "surplus service" from IOT_METER.md: after every
 * tick it recomputes sellable surplus and (optionally) pushes the reading
 * to a backend webhook, e.g. Member 1's `POST /meters/:id/readings` once
 * that API exists. Push failures are logged but never crash the simulator —
 * a flaky demo network shouldn't stop meters from producing data.
 */
class SimulatorManager {
  constructor({ readingsPushUrl = null, surplusPushUrl = null } = {}) {
    this.meters = new Map(); // assetId -> MeterSimulator
    this.timers = new Map(); // assetId -> interval handle
    this.readingsPushUrl = readingsPushUrl; // where to POST every raw reading
    this.surplusPushUrl = surplusPushUrl; // where to POST surplus/listing updates
    this.onReading = null; // optional in-process callback(reading)
    this.onSurplus = null; // optional in-process callback(surplusPayload)
  }

  registerMeter(config) {
    const meter = new MeterSimulator(config);
    this.meters.set(meter.assetId, meter);
    return meter;
  }

  getMeter(assetId) {
    const meter = this.meters.get(assetId);
    if (!meter) {
      const err = new Error(`Meter ${assetId} is not registered`);
      err.code = 'METER_NOT_FOUND';
      throw err;
    }
    return meter;
  }

  listMeters() {
    return Array.from(this.meters.values()).map((m) => ({
      assetId: m.assetId,
      zoneId: m.zoneId,
      type: m.type,
      capacityKw: m.capacityKw,
      hasBattery: m.hasBattery,
      batteryCapacityKwh: m.batteryCapacityKwh,
      batteryChargeKwh: m.batteryChargeKwh,
      scenario: m.scenario.key,
      running: this.timers.has(m.assetId),
      latest: m.latest(),
    }));
  }

  setScenario(assetId, scenarioKey) {
    return this.getMeter(assetId).setScenario(scenarioKey);
  }

  /** Produce a single reading right now, outside the interval loop. */
  async tickOnce(assetId, at) {
    const meter = this.getMeter(assetId);
    const reading = meter.tick(at);
    await this._dispatch(reading);
    return reading;
  }

  /** Start continuous ticking for one meter at a fixed wall-clock cadence. */
  start(assetId, { tickEveryMs = 5000 } = {}) {
    if (this.timers.has(assetId)) return; // already running
    const meter = this.getMeter(assetId);
    const handle = setInterval(async () => {
      const reading = meter.tick();
      await this._dispatch(reading);
    }, tickEveryMs);
    this.timers.set(assetId, handle);
  }

  stop(assetId) {
    const handle = this.timers.get(assetId);
    if (handle) {
      clearInterval(handle);
      this.timers.delete(assetId);
    }
  }

  startAll(opts) {
    for (const assetId of this.meters.keys()) this.start(assetId, opts);
  }

  stopAll() {
    for (const assetId of this.timers.keys()) this.stop(assetId);
  }

  async _dispatch(reading) {
    if (typeof this.onReading === 'function') {
      try {
        this.onReading(reading);
      } catch (err) {
        console.error('onReading callback failed:', err.message);
      }
    }
    if (this.readingsPushUrl) {
      try {
        await postJson(this.readingsPushUrl, reading);
      } catch (err) {
        console.error(`Failed to push reading for ${reading.assetId}:`, err.message);
      }
    }

    if (reading.type === 'PROSUMER') {
      const surplusPayload = {
        assetId: reading.assetId,
        zoneId: reading.zoneId,
        timestamp: reading.timestamp,
        sellableSurplusKwh: reading.sellableSurplusKwh,
      };
      if (typeof this.onSurplus === 'function') {
        try {
          this.onSurplus(surplusPayload);
        } catch (err) {
          console.error('onSurplus callback failed:', err.message);
        }
      }
      if (this.surplusPushUrl && reading.sellableSurplusKwh > 0) {
        try {
          await postJson(this.surplusPushUrl, surplusPayload);
        } catch (err) {
          console.error(`Failed to push surplus for ${reading.assetId}:`, err.message);
        }
      }
    }
  }
}

module.exports = SimulatorManager;
