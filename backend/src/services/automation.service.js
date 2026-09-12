const db = require('./db.service');
const { simulatorManager, surplusService, settlementBridge, blockchainAdapter } = require('./engine.service');
const { matchTrades } = require('./matching.service');

// Map to track ticks for dispute logic
const activeTradesTicks = new Map();

class AutomationService {
  start() {
    console.log('[Automation] Starting end-to-end automation service...');
    
    setInterval(async () => {
      try {
        await matchTrades();
      } catch (e) {
        console.error('[Automation] Auto-matching error:', e.message);
      }
    }, 5000);

    // Initialize simulator with existing meters from database
    setTimeout(async () => {
      const client = await db.getPool().connect();
      try {
        const res = await client.query(`
          SELECT sm.asset_id, sm.meter_type, a.capacity_kw, a.battery_enabled, u.zone_id 
          FROM smart_meters sm
          JOIN solar_assets a ON sm.asset_id = a.id
          JOIN users u ON a.user_id = u.id
        `);
        for (const row of res.rows) {
          simulatorManager.registerMeter({
            assetId: row.asset_id,
            zoneId: row.zone_id,
            type: (row.meter_type === 'CONSUMER' ? 'CONSUMER' : 'PROSUMER'),
            capacityKw: parseFloat(row.capacity_kw),
            hasBattery: row.battery_enabled,
            batteryCapacityKwh: row.battery_enabled ? parseFloat(row.capacity_kw) * 2 : 0,
            batteryChargeKwh: 0,
            scenario: 'SUNNY'
          });
        }
        console.log(`[Automation] Pre-loaded ${res.rows.length} smart meters into simulator.`);
      } catch (err) {
        console.error('[Automation] Error loading meters:', err.message);
      } finally {
        client.release();
      }
    }, 1000);
    
    // Auto-listing on surplus (disabled per new Prosumer config rules)
    simulatorManager.onSurplus = async (payload) => {
      // Intentionally left blank. Prosumers manually configure offers from surplus.
    };

    // Auto-delivery & settlement on meter ticks
    simulatorManager.onReading = async (reading) => {
      if (reading.type !== 'PROSUMER') return;

      try {
        const client = await db.getPool().connect();
        try {
          // Find active LOCKED trades for this asset's seller
          const resAsset = await client.query('SELECT user_id FROM solar_assets WHERE id = $1', [reading.assetId]);
          if (resAsset.rows.length === 0) return;
          const sellerId = resAsset.rows[0].user_id;

          const resTrades = await client.query(`SELECT id, quantity_kwh FROM trades WHERE seller_id = $1 AND status IN ('MATCHED', 'LOCKED')`, [sellerId]);
          
          for (const row of resTrades.rows) {
            const tradeId = row.id;
            const quantity = parseFloat(row.quantity_kwh);
            
            let ticks = activeTradesTicks.get(tradeId) || 0;
            ticks++;
            activeTradesTicks.set(tradeId, ticks);
            
            // For demo speed, let's just assume we deliver 25% of the trade per tick
            const accumulatedDelivery = quantity * (0.25 * ticks);
            
            console.log(`[Automation] Trade ${tradeId.substring(0,8)} Delivery: ${accumulatedDelivery.toFixed(2)} / ${quantity}`);

            // If we've hit the contracted quantity or time limit (e.g. 4 ticks)
            if (accumulatedDelivery >= quantity || ticks >= 4) {
              const finalDelivery = Math.min(accumulatedDelivery, quantity);
              console.log(`[Automation] Finalizing delivery for Trade ${tradeId.substring(0,8)} (Delivered: ${finalDelivery})`);
              
              // Call VerifyDelivery
              const { trade, settlement, walletUpdate } = settlementBridge.finalizeDelivery(tradeId, { 
                deliveredKwh: finalDelivery, 
                meterReadings: [reading] 
              });
              
              await client.query('BEGIN');
              await client.query(`UPDATE trades SET status = $1 WHERE id = $2`, [trade.status, tradeId]);
              await client.query(`
                INSERT INTO settlements (trade_id, gross_amount, platform_fee, grid_fee, refund_amount, seller_credit, buyer_debit, status, settled_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              `, [tradeId, settlement.gross, settlement.fees.platformFee, settlement.fees.gridFee, settlement.refund, walletUpdate.prosumerCredit, walletUpdate.consumerDebit, 'SETTLED', trade.settlement.settledAt]);
              
              if (settlement.isDisputed) {
                await client.query(`
                  INSERT INTO disputes (trade_id, contracted_kwh, delivered_kwh, shortfall_percent, resolution, refund_amount)
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, [tradeId, trade.quantityKwh, finalDelivery, settlement.shortfallPercent, trade.dispute.resolutionNote, settlement.refund]);
              }
              
              await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [walletUpdate.prosumerCredit, walletUpdate.prosumerId]);
              await client.query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [walletUpdate.consumerDebit, walletUpdate.consumerId]);
              await client.query('COMMIT');
              
              activeTradesTicks.delete(tradeId);
              console.log(`[Automation] Trade ${tradeId.substring(0,8)} fully settled! Status: ${trade.status}`);
            }
          }
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      } catch (err) {
        console.error('[Automation] Delivery mapping error:', err.message);
      }
    };
  }
}

module.exports = new AutomationService();
