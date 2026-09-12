/**
 * Minimal REST wrapper around BlockchainAdapter, built on Node's built-in
 * http module (zero external dependencies — safe to run immediately, no
 * npm install needed). Member 1 can either import BlockchainAdapter
 * directly into the Express backend, or call these endpoints if the
 * blockchain layer runs as its own service.
 *
 * Run: node src/server.js
 * Then e.g.:
 *   curl -X POST localhost:4000/api/trades -H "content-type: application/json" \
 *     -d '{"tradeId":2001,"buyer":"alice","seller":"ravi","zoneId":2,"quantityKwh":4.2,"agreedPrice":6.8}'
 *   curl -X POST localhost:4000/api/trades/2001/lock
 *   curl -X POST localhost:4000/api/trades/2001/deliver -H "content-type: application/json" \
 *     -d '{"deliveredKwh":4.1,"meterReadings":[{"t":1,"kwh":4.1}]}'
 *   curl -X POST localhost:4000/api/trades/2001/settle
 *   curl localhost:4000/api/trades/2001/history
 *   curl localhost:4000/api/ledger/verify
 */
const http = require('http');
const { URL } = require('url');
const { BlockchainAdapter, ROLES } = require('./adapter/BlockchainAdapter');

const PORT = process.env.PORT || 4000;
const chain = new BlockchainAdapter({ disputeTolerancePercent: 10 });

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
  if (err.code === 'TRADE_NOT_FOUND') return 404;
  if (err.code === 'DUPLICATE_TRADE' || err.code === 'DUPLICATE_SETTLEMENT') return 409;
  if (err.code === 'UNAUTHORIZED') return 403;
  if (err.code === 'INVALID_TRANSITION') return 422;
  return 400;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean); // ['api','trades', ...]

  try {
    // GET /api/ledger
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'ledger' && !parts[2]) {
      return sendJson(res, 200, chain.getFullLedger());
    }

    // GET /api/ledger/verify
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'ledger' && parts[2] === 'verify') {
      return sendJson(res, 200, chain.verifyLedgerIntegrity());
    }

    // GET /api/trades
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'trades' && !parts[2]) {
      return sendJson(res, 200, chain.listTrades());
    }

    // POST /api/trades
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'trades' && !parts[2]) {
      const body = await readBody(req);
      const result = chain.createTrade(body, ROLES.TRADING_ENGINE);
      return sendJson(res, 201, result);
    }

    if (parts[0] === 'api' && parts[1] === 'trades' && parts[2]) {
      const tradeId = Number(parts[2]);

      // GET /api/trades/:id
      if (req.method === 'GET' && !parts[3]) {
        return sendJson(res, 200, chain.getTrade(tradeId));
      }

      // GET /api/trades/:id/history
      if (req.method === 'GET' && parts[3] === 'history') {
        return sendJson(res, 200, chain.getTradeHistory(tradeId));
      }

      // POST /api/trades/:id/lock
      if (req.method === 'POST' && parts[3] === 'lock') {
        return sendJson(res, 200, chain.lockTrade(tradeId, ROLES.TRADING_ENGINE));
      }

      // POST /api/trades/:id/cancel
      if (req.method === 'POST' && parts[3] === 'cancel') {
        const body = await readBody(req);
        return sendJson(res, 200, chain.cancelTrade(tradeId, body.reason || '', ROLES.TRADING_ENGINE));
      }

      // POST /api/trades/:id/deliver
      if (req.method === 'POST' && parts[3] === 'deliver') {
        const body = await readBody(req);
        return sendJson(res, 200, chain.recordDelivery(tradeId, body, ROLES.METER_VERIFIER));
      }

      // POST /api/trades/:id/dispute/resolve
      if (req.method === 'POST' && parts[3] === 'dispute' && parts[4] === 'resolve') {
        const body = await readBody(req);
        return sendJson(res, 200, chain.resolveDispute(tradeId, body, ROLES.ADMIN));
      }

      // POST /api/trades/:id/settle
      if (req.method === 'POST' && parts[3] === 'settle') {
        return sendJson(res, 200, chain.settleTrade(tradeId, ROLES.SETTLEMENT_ENGINE));
      }
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    return sendJson(res, errorStatus(err), { error: err.message, code: err.code || null });
  }
});

server.listen(PORT, () => {
  console.log(`SolarLink blockchain adapter listening on http://localhost:${PORT}`);
});

module.exports = server;
