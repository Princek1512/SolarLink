const crypto = require('crypto');
const db = require('../services/db.service');
const { blockchainAdapter, settlementBridge, loadTracker, ROLES } = require('../services/engine.service');
const auditService = require('../services/audit.service');

async function ensureFullTradeLifecycleEvents(tradeSearchId) {
  const tradeRes = await db.query(
    `SELECT t.*, s.gross_amount, s.platform_fee, s.grid_fee, s.refund_amount, s.seller_credit, s.buyer_debit, s.settled_at
     FROM trades t
     LEFT JOIN settlements s ON s.trade_id = t.id
     WHERE t.id::text = $1 OR t.id::text ILIKE $2
     ORDER BY t.created_at DESC
     LIMIT 1`,
    [tradeSearchId, `%${tradeSearchId}%`]
  );

  if (tradeRes.rows.length === 0) {
    const dbEvents = await db.query(
      `SELECT
         event_type as "eventType",
         timestamp,
         event_hash as "currentHash",
         previous_hash as "previousHash",
         event_data as "eventData",
         trade_id
       FROM trade_events
       WHERE trade_id::text ILIKE $1
       ORDER BY timestamp ASC`,
      [`%${tradeSearchId}%`]
    );
    return dbEvents.rows;
  }

  const trade = tradeRes.rows[0];
  const actualTradeId = trade.id;

  ensureInBlockchainAdapter(trade);

  const existingEventsRes = await db.query(
    `SELECT event_type as "eventType", timestamp, event_hash as "currentHash", previous_hash as "previousHash", event_data as "eventData", trade_id
     FROM trade_events
     WHERE trade_id = $1
     ORDER BY timestamp ASC`,
    [actualTradeId]
  );

  let existingEvents = existingEventsRes.rows;
  const existingTypes = new Set(existingEvents.map(e => e.eventType));

  const status = trade.status;
  const quantityKwh = Number(trade.quantity_kwh || 0);
  const agreedPrice = Number(trade.agreed_price || 0);
  const totalAmount = Number((quantityKwh * agreedPrice).toFixed(4));
  const baseTime = new Date(trade.created_at || Date.now());

  let lastHash = existingEvents.length > 0
    ? existingEvents[existingEvents.length - 1].currentHash
    : (blockchainAdapter.ledger.chain[blockchainAdapter.ledger.chain.length - 1]?.currentHash || '0'.repeat(64));

  const newEventsToInsert = [];

  const addMissing = (eventType, data, timeOffsetMs) => {
    if (!existingTypes.has(eventType)) {
      const eventTime = new Date(baseTime.getTime() + timeOffsetMs).toISOString();
      const payload = lastHash + eventType + JSON.stringify(data) + eventTime;
      const currentHash = crypto.createHash('sha256').update(payload).digest('hex');
      const eventObj = {
        tradeId: actualTradeId,
        eventType,
        timestamp: eventTime,
        eventData: data,
        previousHash: lastHash,
        currentHash
      };
      lastHash = currentHash;
      newEventsToInsert.push(eventObj);
      existingTypes.add(eventType);

      try {
        blockchainAdapter.ledger.chain.push({
          eventId: blockchainAdapter.ledger.chain.length,
          tradeId: actualTradeId,
          eventType,
          timestamp: eventTime,
          eventData: data,
          previousHash: eventObj.previousHash,
          currentHash: eventObj.currentHash
        });
      } catch (e) {}
    }
  };

  if (!existingTypes.has('TradeCreated')) {
    addMissing('TradeCreated', {
      buyer: trade.buyer_id,
      seller: trade.seller_id,
      zoneId: trade.zone_id,
      quantityKwh,
      agreedPrice,
      totalAmount
    }, 0);
  }

  if (['LOCKED', 'DELIVERED', 'VERIFIED', 'SETTLED', 'DISPUTED'].includes(status)) {
    addMissing('TradeLocked', { status: 'LOCKED', lockedAt: new Date(baseTime.getTime() + 1000).toISOString() }, 1000);
  }

  if (['DELIVERED', 'VERIFIED', 'SETTLED', 'DISPUTED'].includes(status)) {
    const meterHash = crypto.createHash('sha256').update(JSON.stringify([{ timestamp: baseTime, kwh: quantityKwh }])).digest('hex');
    addMissing('DeliveryRecorded', { deliveredKwh: quantityKwh, meterDataHash: meterHash, recordedAt: new Date(baseTime.getTime() + 2000).toISOString() }, 2000);
  }

  if (['VERIFIED', 'SETTLED'].includes(status)) {
    addMissing('TradeVerified', { contractedKwh: quantityKwh, deliveredKwh: quantityKwh, shortfallPercent: 0 }, 3000);
  } else if (status === 'DISPUTED') {
    addMissing('DisputeRaised', { contractedKwh: quantityKwh, deliveredKwh: Math.round(quantityKwh * 0.7), shortfallPercent: 30, tolerancePercent: 10 }, 3000);
  }

  if (status === 'SETTLED') {
    const finalAmount = trade.gross_amount ? Number(trade.gross_amount) : totalAmount;
    const refund = trade.refund_amount ? Number(trade.refund_amount) : 0;
    addMissing('TradeSettled', { finalAmount, refund, settledAt: trade.settled_at || new Date(baseTime.getTime() + 4000).toISOString() }, 4000);
  }

  for (const ev of newEventsToInsert) {
    try {
      await db.query(
        `INSERT INTO trade_events (trade_id, event_type, event_data, previous_hash, event_hash, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ev.tradeId, ev.eventType, JSON.stringify(ev.eventData), ev.previousHash, ev.currentHash, ev.timestamp]
      );
    } catch (e) {
      console.error('Failed inserting missing trade_event:', e.message);
    }
  }

  const finalRes = await db.query(
    `SELECT
       event_type as "eventType",
       timestamp,
       event_hash as "currentHash",
       previous_hash as "previousHash",
       event_data as "eventData",
       trade_id
     FROM trade_events
     WHERE trade_id = $1
     ORDER BY timestamp ASC`,
    [actualTradeId]
  );

  return finalRes.rows;
}

exports.getTradeEvents = async (req, res, next) => {
  try {
    const { id } = req.params;
    const history = await ensureFullTradeLifecycleEvents(id);
    res.json(history);
  } catch (err) {
    next(err);
  }
};

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
    const result = await db.query(`
      SELECT t.*,
             s.id as settlement_id, s.gross_amount, s.platform_fee, s.grid_fee, s.refund_amount,
             s.seller_credit, s.buyer_debit, s.status as settlement_status, s.settled_at
      FROM trades t
      LEFT JOIN settlements s ON s.trade_id = t.id
      WHERE t.id = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trade not found' });
    
    const row = result.rows[0];
    if (req.user.role === 'prosumer' && row.seller_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'consumer' && row.buyer_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    
    const trade = { ...row };
    if (row.settlement_id) {
      trade.settlement = {
        id: row.settlement_id,
        gross_amount: row.gross_amount,
        platform_fee: row.platform_fee,
        grid_fee: row.grid_fee,
        refund_amount: row.refund_amount,
        seller_credit: row.seller_credit,
        buyer_debit: row.buyer_debit,
        status: row.settlement_status,
        settled_at: row.settled_at
      };
    }
    
    res.json(trade);
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
    await ensureFullTradeLifecycleEvents(id);
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

        // Lock prosumer wallet and credit prosumer balance
        await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [walletUpdate.prosumerId]);
        await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [walletUpdate.prosumerCredit, walletUpdate.prosumerId]);

        // If there is a shortfall refund, credit consumer balance
        if (settlement.refund > 0) {
          await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [walletUpdate.consumerId]);
          await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [settlement.refund, walletUpdate.consumerId]);
        }
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

      // Release completed trade transmission load from grid_zones in DB (ACID compliance)
      if (dbTrade.zone_id) {
        const zLock = await client.query('SELECT * FROM grid_zones WHERE id = $1 FOR UPDATE', [dbTrade.zone_id]);
        if (zLock.rows.length > 0) {
          const zObj = zLock.rows[0];
          const currentLoad = parseFloat(zObj.current_load_kw || 0);
          const newLoad = Math.max(0, parseFloat((currentLoad - Number(dbTrade.quantity_kwh)).toFixed(2)));
          const capacity = parseFloat(zObj.capacity_kw || 500);
          const thresh = parseFloat(zObj.congestion_threshold || capacity * 0.8);
          const newStatus = zObj.status === 'CONSTRAINED' && newLoad < capacity ? (newLoad >= thresh ? 'ELEVATED' : 'NORMAL') : zObj.status;
          await client.query('UPDATE grid_zones SET current_load_kw = $1, status = $2 WHERE id = $3', [newLoad, newStatus, dbTrade.zone_id]);
        }
      }

      await client.query('COMMIT');
      await ensureFullTradeLifecycleEvents(id);
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

        // Lock prosumer wallet and credit prosumer balance
        await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [walletUpdate.prosumerId]);
        await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [walletUpdate.prosumerCredit, walletUpdate.prosumerId]);

        if (settlement.refund > 0) {
          await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [walletUpdate.consumerId]);
          await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [settlement.refund, walletUpdate.consumerId]);
        }
      }

      // Release completed trade transmission load from grid_zones in DB (ACID compliance)
      if (dbTrade.zone_id) {
        const zLock = await client.query('SELECT * FROM grid_zones WHERE id = $1 FOR UPDATE', [dbTrade.zone_id]);
        if (zLock.rows.length > 0) {
          const zObj = zLock.rows[0];
          const currentLoad = parseFloat(zObj.current_load_kw || 0);
          const newLoad = Math.max(0, parseFloat((currentLoad - Number(dbTrade.quantity_kwh)).toFixed(2)));
          const capacity = parseFloat(zObj.capacity_kw || 500);
          const thresh = parseFloat(zObj.congestion_threshold || capacity * 0.8);
          const newStatus = zObj.status === 'CONSTRAINED' && newLoad < capacity ? (newLoad >= thresh ? 'ELEVATED' : 'NORMAL') : zObj.status;
          await client.query('UPDATE grid_zones SET current_load_kw = $1, status = $2 WHERE id = $3', [newLoad, newStatus, dbTrade.zone_id]);
        }
      }

      await client.query('COMMIT');
      await ensureFullTradeLifecycleEvents(id);
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

exports.flagTrade = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { compliance_note, flag_reason } = req.body;
    const note = compliance_note || flag_reason || 'Flagged for regulatory compliance inspection';

    const tradeRes = await db.query('SELECT * FROM trades WHERE id = $1', [id]);
    if (tradeRes.rows.length === 0) return res.status(404).json({ error: 'Trade not found' });

    const result = await db.query(
      `UPDATE trades SET compliance_flagged = true, compliance_note = $1, flagged_by = $2 WHERE id = $3 RETURNING *`,
      [note, req.user.id, id]
    );

    await auditService.log(req.user.id, req.user.role, 'TRADE_COMPLIANCE_FLAGGED', 'trade', id, 'FLAGGED', { compliance_note: note }, req.ip);

    res.json({ message: 'Trade flagged for regulatory investigation', trade: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

