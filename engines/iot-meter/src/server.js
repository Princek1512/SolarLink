/**
 * REST wrapper around SimulatorManager + SurplusService. Zero external
 * dependencies (built on Node's http module) so it runs immediately.
 *
 * Run: node src/server.js
 * Optional env vars:
 *   PORT=4100
 *   READINGS_PUSH_URL=http://localhost:5000/api/meter-readings   (Member 1's backend)
 *   SURPLUS_PUSH_URL=http://localhost:5000/api/listings/surplus
 *
 * Example:
 *   curl -X POST localhost:4100/api/meters -H "content-type: application/json" \
 *     -d '{"assetId":"prosumer_ravi","zoneId":2,"type":"PROSUMER","capacityKw":5,"hasBattery":true,"batteryCapacityKwh":10}'
 *   curl -X POST localhost:4100/api/meters/prosumer_ravi/start -H "content-type: application/json" -d '{"tickEveryMs":3000}'
 *   curl -X POST localhost:4100/api/meters/prosumer_ravi/scenario -H "content-type: application/json" -d '{"scenario":"HIGH_GENERATION"}'
 *   curl localhost:4100/api/meters/prosumer_ravi/latest
 *   curl localhost:4100/api/market/summary
 */
const http = require('http');
const { URL } = require('url');
const SimulatorManager = require('./simulator/SimulatorManager');
const SurplusService = require('./services/SurplusService');
const { SCENARIOS } = require('./simulator/scenarios');

const PORT = process.env.PORT || 4100;
const manager = new SimulatorManager({
  readingsPushUrl: process.env.READINGS_PUSH_URL || null,
  surplusPushUrl: process.env.SURPLUS_PUSH_URL || null,
});
const surplusService = new SurplusService(manager);

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function errorStatus(err) {
  if (err.code === 'METER_NOT_FOUND') return 404;
  return 400;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    // GET /api/scenarios
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'scenarios') {
      return sendJson(res, 200, SCENARIOS);
    }

    // GET /api/market/summary
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'market' && parts[2] === 'summary') {
      return sendJson(res, 200, surplusService.getZoneSummaries());
    }

    // GET /api/market/listings
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'market' && parts[2] === 'listings') {
      return sendJson(res, 200, surplusService.getAllListableSurplus());
    }

    // GET /api/meters
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'meters' && !parts[2]) {
      return sendJson(res, 200, manager.listMeters());
    }

    // POST /api/meters  (register)
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'meters' && !parts[2]) {
      const body = await readBody(req);
      const meter = manager.registerMeter(body);
      return sendJson(res, 201, { assetId: meter.assetId, zoneId: meter.zoneId, type: meter.type });
    }

    if (parts[0] === 'api' && parts[1] === 'meters' && parts[2]) {
      const assetId = decodeURIComponent(parts[2]);

      // GET /api/meters/:id
      if (req.method === 'GET' && !parts[3]) {
        const meter = manager.getMeter(assetId);
        return sendJson(res, 200, {
          assetId: meter.assetId,
          zoneId: meter.zoneId,
          type: meter.type,
          scenario: meter.scenario.key,
          batteryChargeKwh: meter.batteryChargeKwh,
          latest: meter.latest(),
        });
      }

      // GET /api/meters/:id/latest
      if (req.method === 'GET' && parts[3] === 'latest') {
        return sendJson(res, 200, manager.getMeter(assetId).latest());
      }

      // GET /api/meters/:id/readings?limit=20
      if (req.method === 'GET' && parts[3] === 'readings') {
        const limit = url.searchParams.get('limit');
        return sendJson(res, 200, manager.getMeter(assetId).history(limit ? Number(limit) : undefined));
      }

      // GET /api/meters/:id/surplus
      if (req.method === 'GET' && parts[3] === 'surplus') {
        return sendJson(res, 200, surplusService.getListableSurplus(assetId));
      }

      // POST /api/meters/:id/scenario  { "scenario": "HIGH_GENERATION" }
      if (req.method === 'POST' && parts[3] === 'scenario') {
        const body = await readBody(req);
        const scenario = manager.setScenario(assetId, body.scenario);
        return sendJson(res, 200, { assetId, scenario: scenario.key });
      }

      // POST /api/meters/:id/tick  (produce one reading right now)
      if (req.method === 'POST' && parts[3] === 'tick') {
        const reading = await manager.tickOnce(assetId);
        return sendJson(res, 200, reading);
      }

      // POST /api/meters/:id/start  { "tickEveryMs": 5000 }
      if (req.method === 'POST' && parts[3] === 'start') {
        const body = await readBody(req);
        manager.start(assetId, { tickEveryMs: body.tickEveryMs || 5000 });
        return sendJson(res, 200, { assetId, running: true });
      }

      // POST /api/meters/:id/stop
      if (req.method === 'POST' && parts[3] === 'stop') {
        manager.stop(assetId);
        return sendJson(res, 200, { assetId, running: false });
      }

      // POST /api/meters/:id/delivered  { "committedKwh": 5.0 }
      // Convenience for the delivery-shortfall demo: returns what this
      // meter would report as delivered against a committed trade quantity.
      if (req.method === 'POST' && parts[3] === 'delivered') {
        const body = await readBody(req);
        const meter = manager.getMeter(assetId);
        const deliveredKwh = meter.getDeliveredKwh(body.committedKwh);
        return sendJson(res, 200, { assetId, committedKwh: body.committedKwh, deliveredKwh, scenario: meter.scenario.key });
      }
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    return sendJson(res, errorStatus(err), { error: err.message, code: err.code || null });
  }
});

server.listen(PORT, () => {
  console.log(`SolarLink IoT meter simulator listening on http://localhost:${PORT}`);
  if (manager.readingsPushUrl) console.log(`Pushing readings to ${manager.readingsPushUrl}`);
  if (manager.surplusPushUrl) console.log(`Pushing surplus updates to ${manager.surplusPushUrl}`);
});

module.exports = server;
