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
      const assetId = assets.rows[0].id;
      const meterRes = await db.query('SELECT id FROM smart_meters WHERE asset_id = $1', [assetId]);
      
      if (meterRes.rows.length > 0) {
        meter_id = meterRes.rows[0].id;
        const meterId = meter_id;
        
        const sumRes = await db.query(`
          SELECT COALESCE(SUM(generation_kwh), 0) as total_gen, COALESCE(SUM(consumption_kwh), 0) as total_cons
          FROM meter_readings 
          WHERE meter_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
        `, [meterId]);
        
        today_generation_kwh = parseFloat(sumRes.rows[0].total_gen);
        today_consumption_kwh = parseFloat(sumRes.rows[0].total_cons);
        
        const latestRes = await db.query(`
          SELECT generation_kwh, consumption_kwh FROM meter_readings WHERE meter_id = $1 ORDER BY timestamp DESC LIMIT 1
        `, [meterId]);
        
        if (latestRes.rows.length > 0) {
          const l = latestRes.rows[0];
          current_surplus_kwh = Math.max(0, parseFloat(l.generation_kwh) - parseFloat(l.consumption_kwh));
        }
        
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
    const trades = await db.query('SELECT * FROM trades');
    // Verify ledger integrity
    const ledgerValid = blockchainAdapter.verifyLedgerIntegrity();
    
    res.json({
      total_trades: trades.rows.length,
      ledger_valid: ledgerValid,
      trades: trades.rows
    });
  } catch (err) {
    next(err);
  }
};
