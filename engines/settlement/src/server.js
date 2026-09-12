/**
 * REST wrapper around SettlementEngine. No external dependencies — built on
 * Node's http module, same as the pricing and congestion engines' servers.
 * This does NOT wrap BlockchainBridge/a real adapter — it exposes the pure
 * calculation, which is what a backend needs to preview numbers before
 * committing to on-chain calls.
 *
 * Run: node src/server.js
 *
 * Example:
 *   curl -X POST localhost:4400/api/fees -H "content-type: application/json" \
 *     -d '{"zoneId":2,"platformFeePercent":0.025,"gridFeePercent":0.01}'
 *
 *   curl -X POST localhost:4400/api/settlements -H "content-type: application/json" \
 *     -d '{"tradeId":"t1","zoneId":2,"quantityKwh":10,"agreedPrice":7,"deliveredKwh":8,"tolerancePercent":10}'
 */
const http = require('http');
const { URL } = require('url');
const SettlementEngine = require('./engine/SettlementEngine');

const PORT = process.env.PORT || 4400;
const engine = new SettlementEngine();

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    // POST /api/fees  (configure a zone's platform/grid fee percentages)
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'fees') {
      const body = await readBody(req);
      const zoneId = body.zoneId ?? '_default';
      const zone = engine.configureZoneFees(zoneId, body);
      return sendJson(res, 201, zone);
    }

    // POST /api/settlements  (compute a settlement preview — pure calculation, no side effects)
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'settlements' && !parts[2]) {
      const body = await readBody(req);
      const result = engine.computeSettlement(body);
      return sendJson(res, 200, result);
    }

    // GET /api/settlements/:tradeId/audit
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'settlements' && parts[2] && parts[3] === 'audit') {
      return sendJson(res, 200, engine.getAuditLog(decodeURIComponent(parts[2])));
    }

    // GET /api/settlements/audit  (full audit log)
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'settlements' && parts[2] === 'audit') {
      return sendJson(res, 200, engine.getAuditLog());
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`SolarLink settlement engine listening on http://localhost:${PORT}`);
});

module.exports = server;
