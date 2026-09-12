/**
 * REST wrapper around PricingEngine + PricingScheduler. No external
 * dependencies — built on Node's http module.
 *
 * Run: node src/server.js
 *
 * Example:
 *   curl -X POST localhost:4200/api/zones -H "content-type: application/json" \
 *     -d '{"zoneId":2,"floor":6.0,"ceiling":8.5,"elasticityFactor":1.5,"repricingIntervalMs":60000}'
 *
 *   curl -X POST localhost:4200/api/zones/2/quote -H "content-type: application/json" \
 *     -d '{"supplyKwh":2,"demandKwh":9,"congestionLevel":"ELEVATED"}'
 *
 *   curl localhost:4200/api/zones/2/quote        # last computed quote
 *   curl localhost:4200/api/zones/2/audit         # full audit trail for the zone
 */
const http = require('http');
const { URL } = require('url');
const PricingEngine = require('./engine/PricingEngine');
const PricingScheduler = require('./scheduler/PricingScheduler');
const { DEFAULT_CONGESTION_LEVELS } = require('./engine/CongestionLevels');

const PORT = process.env.PORT || 4200;
const engine = new PricingEngine();
const scheduler = new PricingScheduler(engine);

// Latest raw inputs per zone, used by the scheduler's interval tick.
const currentInputs = new Map();

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
  if (err.code === 'ZONE_NOT_CONFIGURED') return 404;
  return 400;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    // GET /api/congestion-levels
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'congestion-levels') {
      return sendJson(res, 200, DEFAULT_CONGESTION_LEVELS);
    }

    // GET /api/zones
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'zones' && !parts[2]) {
      return sendJson(res, 200, engine.listZones());
    }

    // POST /api/zones  (configure a zone's pricing band)
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'zones' && !parts[2]) {
      const body = await readBody(req);
      const zoneId = body.zoneId;
      const zone = engine.configureZone(zoneId, body);
      return sendJson(res, 201, zone);
    }

    if (parts[0] === 'api' && parts[1] === 'zones' && parts[2]) {
      const zoneId = isNaN(Number(parts[2])) ? decodeURIComponent(parts[2]) : Number(parts[2]);

      // GET /api/zones/:id
      if (req.method === 'GET' && !parts[3]) {
        return sendJson(res, 200, engine.getZoneConfig(zoneId));
      }

      // POST /api/zones/:id/quote  (compute + store an immediate quote)
      if (req.method === 'POST' && parts[3] === 'quote') {
        const body = await readBody(req);
        const quote = engine.computeQuote(zoneId, body);
        currentInputs.set(zoneId, body);
        return sendJson(res, 200, quote);
      }

      // GET /api/zones/:id/quote  (last computed quote)
      if (req.method === 'GET' && parts[3] === 'quote') {
        return sendJson(res, 200, engine.getLastQuote(zoneId));
      }

      // GET /api/zones/:id/audit
      if (req.method === 'GET' && parts[3] === 'audit') {
        return sendJson(res, 200, engine.getAuditLog(zoneId));
      }

      // POST /api/zones/:id/inputs  (push new live inputs; recomputes now if the change is "major")
      if (req.method === 'POST' && parts[3] === 'inputs') {
        const body = await readBody(req);
        currentInputs.set(zoneId, body);
        const result = scheduler.pushInputs(zoneId, body);
        return sendJson(res, 200, result);
      }

      // POST /api/zones/:id/schedule/start
      if (req.method === 'POST' && parts[3] === 'schedule' && parts[4] === 'start') {
        if (!currentInputs.has(zoneId)) {
          return sendJson(res, 400, { error: 'Post inputs via /api/zones/:id/inputs before starting the schedule' });
        }
        scheduler.start(zoneId, () => currentInputs.get(zoneId));
        return sendJson(res, 200, { zoneId, scheduled: true });
      }

      // POST /api/zones/:id/schedule/stop
      if (req.method === 'POST' && parts[3] === 'schedule' && parts[4] === 'stop') {
        scheduler.stop(zoneId);
        return sendJson(res, 200, { zoneId, scheduled: false });
      }
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    return sendJson(res, errorStatus(err), { error: err.message, code: err.code || null });
  }
});

server.listen(PORT, () => {
  console.log(`SolarLink pricing engine listening on http://localhost:${PORT}`);
});

module.exports = server;
