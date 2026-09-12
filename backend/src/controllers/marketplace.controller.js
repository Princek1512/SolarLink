const db = require('../services/db.service');
const { matchTrades } = require('../services/matching.service');
const auditService = require('../services/audit.service');

exports.getListings = async (req, res, next) => {
  try {
    const { zone_id } = req.query;
    let query = `
      SELECT l.*, u.name as producer_name 
      FROM energy_listings l
      JOIN users u ON l.seller_id = u.id
      WHERE l.status = $1
    `;
    const params = ['ACTIVE'];
    
    if (zone_id) {
      query += ' AND l.zone_id = $2';
      params.push(zone_id);
    }
    
    query += ' ORDER BY l.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createListing = async (req, res, next) => {
  try {
    let { quantity_kwh, asking_price } = req.body;
    quantity_kwh = parseFloat(quantity_kwh);
    asking_price = parseFloat(asking_price);

    if (!quantity_kwh || quantity_kwh <= 0) return res.status(400).json({ error: 'Invalid quantity' });

    const userRes = await db.query('SELECT zone_id FROM users WHERE id = $1', [req.user.id]);
    const zone_id = userRes.rows[0].zone_id;
    
    if (req.user.role === 'prosumer') {
      const assetRes = await db.query('SELECT id FROM solar_assets WHERE user_id = $1', [req.user.id]);
      if (assetRes.rows.length === 0) return res.status(400).json({ error: 'No active asset found' });
      
      const meterRes = await db.query('SELECT id FROM smart_meters WHERE asset_id = $1', [assetRes.rows[0].id]);
      if (meterRes.rows.length === 0) return res.status(400).json({ error: 'No active meter found' });
      
      const meterId = meterRes.rows[0].id;
      const latestRes = await db.query(`SELECT generation_kwh, consumption_kwh FROM meter_readings WHERE meter_id = $1 ORDER BY timestamp DESC LIMIT 1`, [meterId]);
      
      let currentEligibleSurplus = 0;
      if (latestRes.rows.length > 0) {
        const l = latestRes.rows[0];
        currentEligibleSurplus = Math.max(0, parseFloat(l.generation_kwh) - parseFloat(l.consumption_kwh));
      }
      
      const activeListingsRes = await db.query(`SELECT COALESCE(SUM(remaining_kwh), 0) as committed FROM energy_listings WHERE seller_id = $1 AND status = 'ACTIVE'`, [req.user.id]);
      const activeTradesRes = await db.query(`SELECT COALESCE(SUM(quantity_kwh), 0) as trade_committed FROM trades WHERE seller_id = $1 AND status IN ('MATCHED', 'LOCKED', 'DELIVERED')`, [req.user.id]);
      
      const alreadyCommittedQuantity = parseFloat(activeListingsRes.rows[0].committed) + parseFloat(activeTradesRes.rows[0].trade_committed);
      const availableSellableEnergy = currentEligibleSurplus - alreadyCommittedQuantity;
      
      if (quantity_kwh > availableSellableEnergy) {
        return res.status(400).json({ error: 'INSUFFICIENT_SURPLUS', message: `Cannot sell ${quantity_kwh} kWh. Only ${availableSellableEnergy.toFixed(2)} kWh available.` });
      }
    }
    
    const result = await db.query(
      `INSERT INTO energy_listings (seller_id, zone_id, quantity_kwh, remaining_kwh, asking_price) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, zone_id, quantity_kwh, quantity_kwh, asking_price]
    );
    
    // Trigger matching
    await matchTrades();
    auditService.log(req.user.id, req.user.role, 'LISTING_CREATED', 'energy_listing', result.rows[0].id, 'ACTIVE', { quantity_kwh, asking_price, zone_id }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { quantity_kwh, asking_price } = req.body;
    
    const listingRes = await db.query('SELECT * FROM energy_listings WHERE id = $1', [id]);
    if (listingRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const listing = listingRes.rows[0];
    
    if (req.user.role === 'prosumer' && listing.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (quantity_kwh !== undefined && req.user.role === 'prosumer') {
      quantity_kwh = parseFloat(quantity_kwh);
      const assetRes = await db.query('SELECT id FROM solar_assets WHERE user_id = $1', [req.user.id]);
      const meterRes = await db.query('SELECT id FROM smart_meters WHERE asset_id = $1', [assetRes.rows[0].id]);
      const meterId = meterRes.rows[0].id;
      const latestRes = await db.query(`SELECT generation_kwh, consumption_kwh FROM meter_readings WHERE meter_id = $1 ORDER BY timestamp DESC LIMIT 1`, [meterId]);
      
      let currentEligibleSurplus = 0;
      if (latestRes.rows.length > 0) {
        currentEligibleSurplus = Math.max(0, parseFloat(latestRes.rows[0].generation_kwh) - parseFloat(latestRes.rows[0].consumption_kwh));
      }
      
      const activeListingsRes = await db.query(`SELECT COALESCE(SUM(remaining_kwh), 0) as committed FROM energy_listings WHERE seller_id = $1 AND status = 'ACTIVE' AND id != $2`, [req.user.id, id]);
      const activeTradesRes = await db.query(`SELECT COALESCE(SUM(quantity_kwh), 0) as trade_committed FROM trades WHERE seller_id = $1 AND status IN ('MATCHED', 'LOCKED', 'DELIVERED')`, [req.user.id]);
      
      const alreadyCommittedQuantity = parseFloat(activeListingsRes.rows[0].committed) + parseFloat(activeTradesRes.rows[0].trade_committed);
      const availableSellableEnergy = currentEligibleSurplus - alreadyCommittedQuantity;
      
      if (quantity_kwh > availableSellableEnergy) {
        return res.status(400).json({ error: 'INSUFFICIENT_SURPLUS', message: `Cannot update to ${quantity_kwh} kWh. Only ${availableSellableEnergy.toFixed(2)} kWh available.` });
      }
    }
    
    let query = 'UPDATE energy_listings SET ';
    const params = [];
    let paramIndex = 1;
    
    if (quantity_kwh !== undefined) {
      query += `remaining_kwh = $${paramIndex}, quantity_kwh = $${paramIndex}, `;
      params.push(quantity_kwh);
      paramIndex++;
    }
    if (asking_price !== undefined) {
      query += `asking_price = $${paramIndex}, `;
      params.push(asking_price);
      paramIndex++;
    }
    
    // Remove trailing comma and space
    query = query.slice(0, -2);
    query += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);
    
    if (params.length === 1) return res.json(listing); // Nothing to update
    
    const result = await db.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.cancelListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const listingRes = await db.query('SELECT seller_id, status FROM energy_listings WHERE id = $1', [id]);
    
    if (listingRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'prosumer' && listingRes.rows[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (listingRes.rows[0].status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Only ACTIVE listings can be cancelled' });
    }
    
    const result = await db.query(
      `UPDATE energy_listings SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
      [id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    let query = 'SELECT * FROM buy_orders ORDER BY created_at DESC';
    let params = [];
    if (req.user.role === 'consumer') {
      query = 'SELECT * FROM buy_orders WHERE buyer_id = $1 ORDER BY created_at DESC';
      params = [req.user.id];
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const { quantity_kwh, max_price } = req.body;
    const userRes = await db.query('SELECT zone_id FROM users WHERE id = $1', [req.user.id]);
    const zone_id = userRes.rows[0].zone_id;
    
    const result = await db.query(
      `INSERT INTO buy_orders (buyer_id, zone_id, quantity_kwh, max_price) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, zone_id, quantity_kwh, max_price]
    );
    
    // Trigger matching
    await matchTrades();
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.purchaseListing = async (req, res, next) => {
  try {
    const { id } = req.params; // listingId
    const { quantityKwh } = req.body;
    const consumerId = req.user.id;

    if (!quantityKwh || quantityKwh <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');

      // 1. Lock consumer wallet and check sufficient balance (ACID compliance)
      const walletRes = await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [consumerId]);
      if (walletRes.rows.length === 0) {
        throw new Error('Consumer wallet not found');
      }
      const consumerBalance = parseFloat(walletRes.rows[0].balance);

      // 2. Lock the listing atomically
      const listingRes = await client.query('SELECT * FROM energy_listings WHERE id = $1 AND status = $2 FOR UPDATE', [id, 'ACTIVE']);
      if (listingRes.rows.length === 0) {
        throw new Error('Listing not found or no longer active');
      }
      const listing = listingRes.rows[0];

      if (quantityKwh > parseFloat(listing.remaining_kwh)) {
        throw new Error(`Requested quantity exceeds available energy (${listing.remaining_kwh} kWh left)`);
      }

      const agreedPrice = parseFloat(listing.asking_price);
      const totalCost = parseFloat((quantityKwh * agreedPrice).toFixed(4));

      if (consumerBalance < totalCost) {
        throw new Error(`Insufficient wallet balance. Required: $${totalCost.toFixed(2)}, Available: $${consumerBalance.toFixed(2)}`);
      }

      // Check congestion limits
      const { pricingBridge, congestionEngine } = require('../services/engine.service');
      
      try {
        congestionEngine.getZoneConfig(listing.zone_id);
      } catch (e) {
        if (e.code === 'ZONE_NOT_CONFIGURED') {
          const zRes = await client.query('SELECT * FROM grid_zones WHERE id = $1', [listing.zone_id]);
          if (zRes.rows.length > 0) {
            const z = zRes.rows[0];
            congestionEngine.configureZone(listing.zone_id, {
              capacityKwh: parseFloat(z.capacity_kw),
              thresholdKwh: parseFloat(z.congestion_threshold)
            });
          }
        }
      }

      const precheck = pricingBridge.precheckTrade(listing.zone_id, quantityKwh);
      if (precheck.wouldAllow === false) {
        throw new Error('Trade rejected by Congestion Engine due to grid limits');
      }

      // 3. Deduct total cost from Consumer wallet atomically
      await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2', [totalCost, consumerId]);

      // 4. Reduce listing quantity
      const newRemaining = parseFloat(listing.remaining_kwh) - quantityKwh;
      const newStatus = newRemaining <= 0 ? 'SOLD' : 'ACTIVE';
      
      await client.query(`UPDATE energy_listings SET remaining_kwh = $1, status = $2 WHERE id = $3`, [newRemaining, newStatus, listing.id]);

      // 5. Create Trade via blockchain
      const { blockchainAdapter, loadTracker, ROLES } = require('../services/engine.service');
      const tradeId = require('uuid').v4();
      
      const { trade, event } = blockchainAdapter.createTrade({
        tradeId,
        buyer: consumerId,
        seller: listing.seller_id,
        zoneId: listing.zone_id,
        quantityKwh,
        agreedPrice
      }, ROLES.TRADING_ENGINE);

      // 6. Persist Trade to DB
      await client.query(`
        INSERT INTO trades (id, listing_id, seller_id, buyer_id, zone_id, quantity_kwh, agreed_price, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [trade.tradeId, listing.id, trade.seller, trade.buyer, trade.zoneId, trade.quantityKwh, trade.agreedPrice, trade.status]);

      // 7. Persist Trade Event
      await client.query(`
        INSERT INTO trade_events (trade_id, event_type, event_data, previous_hash, event_hash)
        VALUES ($1, $2, $3, $4, $5)
      `, [trade.tradeId, event.eventType, event.eventData, event.previousHash, event.currentHash]);

      loadTracker.sync(trade);

      await client.query('COMMIT');
      auditService.log(consumerId, req.user.role, 'ENERGY_PURCHASED', 'trade', trade.tradeId, 'MATCHED', { listing_id: id, quantity_kwh: quantityKwh, agreed_price: agreedPrice, total_cost: totalCost, seller_id: listing.seller_id }, req.ip);
      res.status(201).json(trade);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('exceeds') || err.message.includes('rejected')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
};
