/**
 * REST wrapper around CongestionEngine + LoadTracker. No external
 * dependencies — built on Node's http module, same as
 * solarlink-pricing-engine/src/server.js.
 *
 * Run: node src/server.js
 *
 * Example:
 *   curl -X POST localhost:4300/api/zones -H "content-type: application/json" \
 *     -d '{"zoneId":2,"capacityKwh":100,"thresholdKwh":70}'
 *
 *   curl -X POST localhost:4300/api/zones/2/trades -H "content-type: application/json" \
 *     -d '{"tradeId":"t1","quantityKwh":40,"status":"MATCHED"}'
 *
 *   curl localhost:4300/api/zones/2/status
 *   curl -X POST localhost:4300/api/zones/2/check -d '{"requestedQuantityKwh":35}'
 */
const http = require('http');
const { URL } = require('url');
const CongestionEngine = require('./engine/CongestionEngine');

const PORT = process.env.PORT || 4300;
const engine = new CongestionEngine();

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
    // GET /api/zones
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'zones' && !parts[2]) {
      return sendJson(res, 200, engine.listZones());
    }

    // POST /api/zones  (configure a zone's capacity/threshold)
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'zones' && !parts[2]) {
      const body = await readBody(req);
      const zone = engine.configureZone(body.zoneId, body);
      return sendJson(res, 201, zone);
    }

    if (parts[0] === 'api' && parts[1] === 'zones' && parts[2]) {
      const zoneId = isNaN(Number(parts[2])) ? decodeURIComponent(parts[2]) : Number(parts[2]);

      // GET /api/zones/:id
      if (req.method === 'GET' && !parts[3]) {
        return sendJson(res, 200, engine.getZoneConfig(zoneId));
      }

      // POST /api/zones/:id/trades  (sync a trade's status into the load tracker)
      if (req.method === 'POST' && parts[3] === 'trades' && !parts[4]) {
        const body = await readBody(req);
        engine.getZoneConfig(zoneId); // 404s cleanly if the zone isn't configured
        const currentLoadKwh = engine.loadTracker.sync({ ...body, zoneId });
        return sendJson(res, 200, { zoneId, currentLoadKwh, activeTrades: engine.loadTracker.listActiveTrades(zoneId) });
      }

      // GET /api/zones/:id/load
      if (req.method === 'GET' && parts[3] === 'load') {
        engine.getZoneConfig(zoneId);
        return sendJson(res, 200, {
          zoneId,
          currentLoadKwh: engine.loadTracker.getCurrentLoad(zoneId),
          activeTrades: engine.loadTracker.listActiveTrades(zoneId),
        });
      }

      // GET /api/zones/:id/status  (evaluate current congestion, no projection)
      if (req.method === 'GET' && parts[3] === 'status') {
        return sendJson(res, 200, engine.evaluate(zoneId));
      }

      // POST /api/zones/:id/check  (project a candidate order's quantity, read-only)
      if (req.method === 'POST' && parts[3] === 'check') {
        const body = await readBody(req);
        return sendJson(res, 200, engine.checkNewTrade(zoneId, body.requestedQuantityKwh));
      }

      // POST /api/zones/:id/override  (hackathon-demo manual level toggle)
      if (req.method === 'POST' && parts[3] === 'override') {
        const body = await readBody(req);
        return sendJson(res, 200, engine.setOverride(zoneId, body.level));
      }

      // DELETE /api/zones/:id/override
      if (req.method === 'DELETE' && parts[3] === 'override') {
        return sendJson(res, 200, engine.clearOverride(zoneId));
      }

      // GET /api/zones/:id/audit
      if (req.method === 'GET' && parts[3] === 'audit') {
        return sendJson(res, 200, engine.getAuditLog(zoneId));
      }
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    return sendJson(res, errorStatus(err), { error: err.message, code: err.code || null });
  }
});

server.listen(PORT, () => {
  console.log(`SolarLink congestion engine listening on http://localhost:${PORT}`);
});

module.exports = server;
