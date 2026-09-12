const db = require('../services/db.service');
const { surplusService, blockchainAdapter } = require('../services/engine.service');

exports.getMarketDashboard = async (req, res, next) => {
  try {
    const zones = await db.query('SELECT * FROM grid_zones');
    const summaries = surplusService.getZoneSummaries();
    
    const marketData = zones.rows.map(zone => {
      const surplus = summaries.find(s => s.zoneId === zone.id);
      return {
        ...zone,
        available_surplus_kwh: surplus ? surplus.totalAvailableKwh : 0
      };
    });
    
    res.json(marketData);
  } catch (err) {
    next(err);
  }
};

exports.getProsumerDashboard = async (req, res, next) => {
  try {
    const assets = await db.query('SELECT * FROM solar_assets WHERE user_id = $1', [req.user.id]);
    const listings = await db.query('SELECT * FROM energy_listings WHERE seller_id = $1', [req.user.id]);
    const trades = await db.query('SELECT * FROM trades WHERE seller_id = $1', [req.user.id]);
    const wallet = await db.query('SELECT balance FROM wallets WHERE user_id = $1', [req.user.id]);
    
    let today_generation_kwh = 0;
    let today_consumption_kwh = 0;
    let current_surplus_kwh = 0;
    let sell_eligible = false;
    let meter_id = null;
    
    if (assets.rows.length > 0) {
      const assetIds = assets.rows.map(a => a.id);
      const meterRes = await db.query('SELECT id FROM smart_meters WHERE asset_id = ANY($1::uuid[])', [assetIds]);
      
      if (meterRes.rows.length > 0) {
        meter_id = meterRes.rows[0].id;
        const meterIds = meterRes.rows.map(m => m.id);
        
        const sumRes = await db.query(`
          SELECT COALESCE(SUM(generation_kwh), 0) as total_gen, COALESCE(SUM(consumption_kwh), 0) as total_cons
          FROM meter_readings 
          WHERE meter_id = ANY($1::uuid[]) AND timestamp >= NOW() - INTERVAL '24 hours'
        `, [meterIds]);
        
        today_generation_kwh = parseFloat(sumRes.rows[0].total_gen);
        today_consumption_kwh = parseFloat(sumRes.rows[0].total_cons);
        
        // Net surplus accumulated over active 24h window
        current_surplus_kwh = Math.max(0, today_generation_kwh - today_consumption_kwh);
        
        if (current_surplus_kwh > 0) {
          sell_eligible = true;
        }
      }
    }
    
    const settledRes = await db.query(`
      SELECT COALESCE(SUM(seller_credit), 0) as total_settled
      FROM settlements s
      JOIN trades t ON s.trade_id = t.id
      WHERE t.seller_id = $1 AND s.status = 'SETTLED'
    `, [req.user.id]);
    
    const settled_amount = parseFloat(settledRes.rows[0].total_settled);
    
    const activeListingsRes = await db.query(`SELECT COALESCE(SUM(remaining_kwh), 0) as committed FROM energy_listings WHERE seller_id = $1 AND status = 'ACTIVE'`, [req.user.id]);
    const activeTradesRes = await db.query(`SELECT COALESCE(SUM(quantity_kwh), 0) as trade_committed FROM trades WHERE seller_id = $1 AND status IN ('MATCHED', 'LOCKED', 'DELIVERED')`, [req.user.id]);
    const already_committed_quantity = parseFloat(activeListingsRes.rows[0].committed) + parseFloat(activeTradesRes.rows[0].trade_committed);
    const available_sellable_energy = Math.max(0, current_surplus_kwh - already_committed_quantity);

    res.json({
      assets: assets.rows,
      listings: listings.rows,
      trades: trades.rows,
      wallet_balance: wallet.rows[0]?.balance || 0,
      today_generation_kwh,
      today_consumption_kwh,
      current_surplus_kwh,
      sell_eligible,
      settled_amount,
      already_committed_quantity,
      available_sellable_energy,
      meter_id
    });
  } catch (err) {
    next(err);
  }
};

exports.getConsumerDashboard = async (req, res, next) => {
  try {
    const orders = await db.query('SELECT * FROM buy_orders WHERE buyer_id = $1', [req.user.id]);
    const trades = await db.query('SELECT * FROM trades WHERE buyer_id = $1', [req.user.id]);
    const wallet = await db.query('SELECT balance FROM wallets WHERE user_id = $1', [req.user.id]);
    
    res.json({
      orders: orders.rows,
      trades: trades.rows,
      wallet_balance: wallet.rows[0]?.balance || 0
    });
  } catch (err) {
    next(err);
  }
};

exports.getRegulatorDashboard = async (req, res, next) => {
  try {
    const tradesRes = await db.query(`
      SELECT t.*, u_seller.name as seller_name, u_buyer.name as buyer_name
      FROM trades t
      JOIN users u_seller ON t.seller_id = u_seller.id
      JOIN users u_buyer ON t.buyer_id = u_buyer.id
      ORDER BY t.created_at DESC
    `);
    const trades = tradesRes.rows;

    const disputesRes = await db.query('SELECT * FROM disputes ORDER BY created_at DESC');
    const disputes = disputesRes.rows;

    const flaggedRes = await db.query('SELECT * FROM trades WHERE compliance_flagged = true ORDER BY created_at DESC');
    const flaggedTrades = flaggedRes.rows;

    // Verify cryptographic SHA-256 ledger integrity
    const ledgerValid = blockchainAdapter.verifyLedgerIntegrity();

    // Calculate Pricing Fairness Metrics
    let totalVolumeKwh = 0;
    let totalValueUsd = 0;

    trades.forEach(t => {
      const q = parseFloat(t.quantity_kwh || 0);
      const p = parseFloat(t.agreed_price || 0);
      totalVolumeKwh += q;
      totalValueUsd += (q * p);
    });

    const avgP2pRate = totalVolumeKwh > 0 ? (totalValueUsd / totalVolumeKwh) : 0.1500;
    const gridRetailRate = 0.2200;
    const feedInRate = 0.0800;

    const consumerSavingsPercent = ((gridRetailRate - avgP2pRate) / gridRetailRate) * 100;
    const prosumerGainPercent = ((avgP2pRate - feedInRate) / feedInRate) * 100;

    res.json({
      total_trades: trades.length,
      total_volume_kwh: totalVolumeKwh,
      total_value_usd: totalValueUsd,
      avg_p2p_rate: avgP2pRate,
      grid_retail_rate: gridRetailRate,
      feed_in_rate: feedInRate,
      consumer_savings_percent: Math.max(0, consumerSavingsPercent),
      prosumer_gain_percent: Math.max(0, prosumerGainPercent),
      ledger_valid: ledgerValid,
      flagged_count: flaggedTrades.length,
      flagged_trades: flaggedTrades,
      disputes_count: disputes.length,
      disputes: disputes,
      trades: trades
    });
  } catch (err) {
    next(err);
  }
};

exports.getUtilityDashboard = async (req, res, next) => {
  try {
    const zonesRes = await db.query('SELECT * FROM grid_zones ORDER BY id ASC');
    const zones = zonesRes.rows;

    const summaries = surplusService.getZoneSummaries();
    const pricingConfigsRes = await db.query('SELECT * FROM pricing_configs');
    const pricingConfigs = pricingConfigsRes.rows;

    // 1. ACID-compliant active trade transmission load query
    const activeTradeLoadsRes = await db.query(`
      SELECT zone_id, COALESCE(SUM(quantity_kwh), 0) as trade_load
      FROM trades
      WHERE status IN ('MATCHED', 'LOCKED', 'DELIVERED')
      GROUP BY zone_id
    `);
    const tradeLoadMap = {};
    activeTradeLoadsRes.rows.forEach(r => { tradeLoadMap[r.zone_id] = parseFloat(r.trade_load || 0); });

    // 2. Active meter telemetry consumption load query
    const meterLoadsRes = await db.query(`
      SELECT u.zone_id, COALESCE(SUM(mr.consumption_kwh), 0) as base_load
      FROM meter_readings mr
      JOIN smart_meters sm ON mr.meter_id = sm.id
      JOIN solar_assets sa ON sm.asset_id = sa.id
      JOIN users u ON sa.user_id = u.id
      WHERE mr.timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY u.zone_id
    `);
    const baseLoadMap = {};
    meterLoadsRes.rows.forEach(r => { baseLoadMap[r.zone_id] = parseFloat(r.base_load || 0); });

    const metersRes = await db.query(`
      SELECT u.zone_id, COUNT(sm.id) as meter_count 
      FROM smart_meters sm 
      JOIN solar_assets sa ON sm.asset_id = sa.id 
      JOIN users u ON sa.user_id = u.id 
      GROUP BY u.zone_id
    `);
    const meterMap = {};
    metersRes.rows.forEach(r => { meterMap[r.zone_id] = parseInt(r.meter_count); });

    const activeListingsRes = await db.query(`SELECT zone_id, COUNT(*) as listing_count, SUM(remaining_kwh) as total_kwh FROM energy_listings WHERE status = 'ACTIVE' GROUP BY zone_id`);
    const listingMap = {};
    activeListingsRes.rows.forEach(r => { listingMap[r.zone_id] = { count: parseInt(r.listing_count), kwh: parseFloat(r.total_kwh || 0) }; });

    const enhancedZones = zones.map(zone => {
      const surplus = summaries.find(s => s.zoneId === zone.id);
      const cap = parseFloat(zone.capacity_kw || 500);
      const dbLoad = parseFloat(zone.current_load_kw || 0);
      const activeTradeLoad = tradeLoadMap[zone.id] || 0;
      const baseLoad = baseLoadMap[zone.id] || 0;

      // Real-time ACID-compliant load parameter
      const load = Math.max(dbLoad, Math.round((baseLoad + activeTradeLoad) * 100) / 100);
      const utilPercent = cap > 0 ? (load / cap) * 100 : 0;
      const pricing = pricingConfigs.find(p => p.zone_id === zone.id) || { floor_price: 0.10, ceiling_price: 0.25, congestion_multiplier: 0 };

      return {
        ...zone,
        capacity_kw: cap,
        current_load_kw: load,
        utilization_percent: Math.min(100, Math.round(utilPercent * 10) / 10),
        available_surplus_kwh: surplus ? surplus.totalAvailableKwh : 0,
        meter_count: meterMap[zone.id] || 0,
        active_listings_count: listingMap[zone.id]?.count || 0,
        active_listings_kwh: listingMap[zone.id]?.kwh || 0,
        pricing_config: pricing
      };
    });

    res.json({
      zones: enhancedZones,
      total_zones: enhancedZones.length,
      constrained_count: enhancedZones.filter(z => z.status === 'CONSTRAINED' || z.throttled || z.curtailment_active).length
    });
  } catch (err) {
    next(err);
  }
};

