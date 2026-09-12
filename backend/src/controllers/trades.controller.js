const db = require('../services/db.service');
const { blockchainAdapter, settlementBridge, loadTracker, ROLES } = require('../services/engine.service');
const auditService = require('../services/audit.service');

exports.getTrades = async (req, res, next) => {
  try {
    let result;
    const baseQuery = `
      SELECT t.*, u_seller.name as seller_name, u_buyer.name as buyer_name
      FROM trades t
      JOIN users u_seller ON t.seller_id = u_seller.id
      JOIN users u_buyer ON t.buyer_id = u_buyer.id
    `;
    if (req.user.role === 'admin' || req.user.role === 'regulator' || req.user.role === 'utility') {
      result = await db.query(`${baseQuery} ORDER BY t.created_at DESC`);
    } else {
      result = await db.query(`${baseQuery} WHERE t.seller_id = $1 OR t.buyer_id = $1 ORDER BY t.created_at DESC`, [req.user.id]);
    }
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getTrade = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM trades WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trade not found' });
    
    const trade = result.rows[0];
    if (req.user.role === 'prosumer' && trade.seller_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'consumer' && trade.buyer_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    
    res.json(trade);
  } catch (err) {
    next(err);
  }
};

exports.getTradeEvents = async (req, res, next) => {
  try {
    const { id } = req.params;
    let history = [];

    // 1. Try in-memory blockchain adapter
    try {
      history = blockchainAdapter.getTradeHistory(id) || [];
    } catch (e) {
      // Ignore not found in memory
    }

    // 2. If empty, search DB trade_events using partial/full trade ID match
    if (!history || history.length === 0) {
      const dbEvents = await db.query(
        `SELECT
           event_type as "eventType",
           timestamp,
           event_hash as "currentHash",
           event_data as "eventData",
           trade_id
         FROM trade_events
         WHERE trade_id::text ILIKE $1
         ORDER BY timestamp ASC`,
        [`%${id}%`]
      );
      history = dbEvents.rows;
    }

    // 3. Fallback: Search audit_logs if still empty
    if (!history || history.length === 0) {
      const auditEvents = await db.query(
        `SELECT
           event_type as "eventType",
           created_at as timestamp,
           id as "currentHash",
           details as "eventData",
           entity_id as trade_id
         FROM audit_logs
         WHERE entity_id ILIKE $1 OR id::text ILIKE $1
         ORDER BY created_at ASC`,
        [`%${id}%`]
      );
      history = auditEvents.rows;
    }

    res.json(history);
  } catch (err) {
    next(err);
  }
};

function ensureInBlockchainAdapter(trade) {
  if (!blockchainAdapter.trades.has(trade.id)) {
    try {
      blockchainAdapter.createTrade({
        tradeId: trade.id,
        buyer: trade.buyer_id,
        seller: trade.seller_id,
        zoneId: trade.zone_id,
        quantityKwh: Number(trade.quantity_kwh),
        agreedPrice: Number(trade.agreed_price)
      });
    } catch (e) {
      // Already exists in adapter map
    }
  }
}

exports.lockTrade = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dbRes = await db.query('SELECT * FROM trades WHERE id = $1', [id]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Trade not found' });

    const trade = dbRes.rows[0];
    if (trade.status !== 'MATCHED') {
      return res.status(400).json({ error: `Trade cannot be locked from state '${trade.status}'` });
    }

    ensureInBlockchainAdapter(trade);
    try {
      blockchainAdapter.lockTrade(id);
    } catch (e) {
      // Ignore if adapter state transition fails
    }

    await db.query(`UPDATE trades SET status = 'LOCKED' WHERE id = $1`, [id]);
    await auditService.log(req.user.id, req.user.role, 'TRADE_LOCKED', 'trade', id, 'LOCKED', { trade_id: id }, req.ip);

    res.json({ message: 'Trade locked successfully', trade_id: id, status: 'LOCKED' });
  } catch (err) {
    next(err);
  }
};

exports.verifyDelivery = async (req, res, next) => {
  try {
    const { id } = req.params; // tradeId
    const dbRes = await db.query('SELECT * FROM trades WHERE id = $1', [id]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Trade not found' });
    
    const dbTrade = dbRes.rows[0];
    if (['SETTLED', 'CANCELLED'].includes(dbTrade.status)) {
      return res.status(400).json({ error: `Trade is already ${dbTrade.status}` });
    }

    const inputDeliveredKwh = req.body?.deliveredKwh !== undefined ? Number(req.body.deliveredKwh) : Number(dbTrade.quantity_kwh);
    const meterReadings = req.body?.meterReadings || [];

    ensureInBlockchainAdapter(dbTrade);

    // If trade in adapter is still MATCHED, lock it first
    const adapterTrade = blockchainAdapter.trades.get(id);
    if (adapterTrade && adapterTrade.status === 'MATCHED') {
      try { blockchainAdapter.lockTrade(id); } catch (e) {}
    }

    // Call SettlementBridge -> BlockchainBridge.finalizeDelivery
    const { trade, settlement, walletUpdate } = settlementBridge.finalizeDelivery(id, { deliveredKwh: inputDeliveredKwh, meterReadings });

    // Update DB in a transaction
    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');

      // Update Trade status
      await client.query(`UPDATE trades SET status = $1 WHERE id = $2`, [trade.status, id]);

      // Check if settlement already exists to prevent duplicate insertion
      const existingSettlement = await client.query('SELECT id FROM settlements WHERE trade_id = $1', [id]);
      if (existingSettlement.rows.length === 0) {
        await client.query(`
          INSERT INTO settlements (trade_id, gross_amount, platform_fee, grid_fee, refund_amount, seller_credit, buyer_debit, status, settled_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [id, settlement.gross, settlement.fees.platformFee, settlement.fees.gridFee, settlement.refund, walletUpdate.prosumerCredit, walletUpdate.consumerDebit, 'SETTLED', trade.settlement?.settledAt || new Date()]);

        // Apply wallet updates
        await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [walletUpdate.prosumerCredit, walletUpdate.prosumerId]);
        await client.query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [walletUpdate.consumerDebit, walletUpdate.consumerId]);
      }

      // If disputed, insert dispute
      if (settlement.isDisputed) {
        const existingDispute = await client.query('SELECT id FROM disputes WHERE trade_id = $1', [id]);
        if (existingDispute.rows.length === 0) {
          await client.query(`
            INSERT INTO disputes (trade_id, contracted_kwh, delivered_kwh, shortfall_percent, resolution, refund_amount)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [id, trade.quantityKwh, inputDeliveredKwh, settlement.shortfallPercent, trade.dispute?.resolutionNote || 'Shortfall dispute', settlement.refund]);
        }
      }

      await client.query('COMMIT');
      await auditService.log(req.user.id, req.user.role, 'TRADE_SETTLED', 'trade', id, trade.status, { deliveredKwh: inputDeliveredKwh, settlement_gross: settlement.gross, disputed: settlement.isDisputed }, req.ip);
      res.json({ trade, settlement, walletUpdate });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

exports.autoProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Lock then finalize delivery/settlement automatically
    const dbRes = await db.query('SELECT * FROM trades WHERE id = $1', [id]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Trade not found' });
    
    const dbTrade = dbRes.rows[0];
    if (dbTrade.status === 'SETTLED') {
      return res.json({ message: 'Trade is already SETTLED', trade_id: id });
    }

    ensureInBlockchainAdapter(dbTrade);

    const adapterTrade = blockchainAdapter.trades.get(id);
    if (adapterTrade && adapterTrade.status === 'MATCHED') {
      try { blockchainAdapter.lockTrade(id); } catch (e) {}
    }

    const { trade, settlement, walletUpdate } = settlementBridge.finalizeDelivery(id, { deliveredKwh: Number(dbTrade.quantity_kwh) });

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE trades SET status = $1 WHERE id = $2`, [trade.status, id]);

      const existingSettlement = await client.query('SELECT id FROM settlements WHERE trade_id = $1', [id]);
      if (existingSettlement.rows.length === 0) {
        await client.query(`
          INSERT INTO settlements (trade_id, gross_amount, platform_fee, grid_fee, refund_amount, seller_credit, buyer_debit, status, settled_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [id, settlement.gross, settlement.fees.platformFee, settlement.fees.gridFee, settlement.refund, walletUpdate.prosumerCredit, walletUpdate.consumerDebit, 'SETTLED', trade.settlement?.settledAt || new Date()]);

        await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [walletUpdate.prosumerCredit, walletUpdate.prosumerId]);
        await client.query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [walletUpdate.consumerDebit, walletUpdate.consumerId]);
      }

      await client.query('COMMIT');
      await auditService.log(req.user.id, req.user.role, 'TRADE_SETTLED', 'trade', id, trade.status, { auto_progress: true }, req.ip);
      res.json({ message: 'Trade auto-progressed to SETTLED', trade, settlement, walletUpdate });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

exports.disputeTrade = async (req, res, next) => {
  res.status(501).json({ error: 'Dispute logic is handled automatically during delivery verification.' });
};
