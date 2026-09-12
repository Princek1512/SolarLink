const db = require('./db.service');
const {
  blockchainAdapter,
  ROLES,
  pricingEngine,
  pricingBridge,
  loadTracker,
  surplusService
} = require('./engine.service');

async function matchTrades() {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // 1. Get all active buy orders, ordered by time
    const ordersRes = await client.query(`
      SELECT * FROM buy_orders 
      WHERE status = 'ACTIVE' 
      ORDER BY created_at ASC
    `);
    const orders = ordersRes.rows;

    // 2. Get all active listings, ordered by time
    const listingsRes = await client.query(`
      SELECT * FROM energy_listings 
      WHERE status = 'ACTIVE' AND remaining_kwh > 0
      ORDER BY created_at ASC
    `);
    const listings = listingsRes.rows;

    const matchedTrades = [];

    // Basic deterministic matching: same zone first, then price within max, then sufficient quantity
    for (const order of orders) {
      if (order.status !== 'ACTIVE') continue;

      for (const listing of listings) {
        if (listing.status !== 'ACTIVE' || listing.remaining_kwh <= 0) continue;

        // Same zone priority (simplified for MVP)
        if (order.zone_id !== listing.zone_id) continue;

        const tradeZone = order.zone_id;

        // Calculate current supply & demand for the zone
        const demandRes = await client.query(`
          SELECT COALESCE(SUM(quantity_kwh), 0) as total FROM buy_orders 
          WHERE status = 'ACTIVE' AND zone_id = $1
        `, [tradeZone]);
        const demandKwh = parseFloat(demandRes.rows[0].total);

        const supplyRes = await client.query(`
          SELECT COALESCE(SUM(remaining_kwh), 0) as total FROM energy_listings 
          WHERE status = 'ACTIVE' AND zone_id = $1
        `, [tradeZone]);
        const supplyKwh = parseFloat(supplyRes.rows[0].total);

        // 3. Get Price from PricingEngine
        // Ensure zone is configured in pricing engine
        try {
          pricingEngine.getZoneConfig(tradeZone);
        } catch (e) {
          if (e.code === 'ZONE_NOT_CONFIGURED') {
            const configRes = await client.query('SELECT * FROM pricing_configs WHERE zone_id = $1', [tradeZone]);
            if (configRes.rows.length > 0) {
              const cfg = configRes.rows[0];
              pricingEngine.configureZone(tradeZone, {
                floor: parseFloat(cfg.floor_price),
                ceiling: parseFloat(cfg.ceiling_price),
                elasticityFactor: parseFloat(cfg.elasticity_factor),
                repricingIntervalMs: parseInt(cfg.repricing_interval)
              });
            }
          }
        }

        let quote;
        try {
          quote = pricingEngine.computeQuote(tradeZone, {
            supplyKwh,
            demandKwh,
            congestionLevel: 'NORMAL' // Will be updated via syncZone if needed, but computeQuote just uses what's passed or defaults.
            // Actually, we should get congestionLevel from CongestionEngine
          });
        } catch (e) {
          // If zone not configured, skip
          console.error(`Pricing failed for zone ${tradeZone}:`, e.message);
          continue;
        }

        let agreedPrice = quote.finalPricePerKwh;

        // If market price is lower than seller's ask, but buyer is willing to pay the ask, clear at the ask price.
        if (agreedPrice < parseFloat(listing.asking_price) && parseFloat(order.max_price) >= parseFloat(listing.asking_price)) {
          agreedPrice = parseFloat(listing.asking_price);
        }

        // Check if price is acceptable
        if (agreedPrice > parseFloat(order.max_price) || agreedPrice < parseFloat(listing.asking_price)) {
          continue; // Price mismatch
        }

        // Determine trade quantity
        const quantityKwh = Math.min(parseFloat(order.quantity_kwh), parseFloat(listing.remaining_kwh));

        // 4. Congestion Pre-check
        // Ensure zone is configured in CongestionEngine
        try {
          const { congestionEngine } = require('./engine.service');
          congestionEngine.getZoneConfig(tradeZone);
        } catch (e) {
          if (e.code === 'ZONE_NOT_CONFIGURED') {
            const zRes = await client.query('SELECT * FROM grid_zones WHERE id = $1', [tradeZone]);
            if (zRes.rows.length > 0) {
              const z = zRes.rows[0];
              const { congestionEngine } = require('./engine.service');
              congestionEngine.configureZone(tradeZone, {
                capacityKwh: parseFloat(z.capacity_kw),
                thresholdKwh: parseFloat(z.congestion_threshold)
              });
            }
          }
        }
        
        const precheck = pricingBridge.precheckTrade(tradeZone, quantityKwh);
        if (precheck.wouldAllow === false || quote.tradeAllowed === false) {
          continue; 
        }

        // 5. Blockchain createTrade
        const tradeId = require('uuid').v4(); // Generate a UUID for the trade
        const { trade, event } = blockchainAdapter.createTrade({
          tradeId,
          buyer: order.buyer_id,
          seller: listing.seller_id,
          zoneId: tradeZone,
          quantityKwh,
          agreedPrice
        }, ROLES.TRADING_ENGINE);

        // 6. Sync load tracker
        loadTracker.sync(trade);

        // 7. Persist to DB
        await client.query(`
          INSERT INTO trades (id, listing_id, buy_order_id, seller_id, buyer_id, zone_id, quantity_kwh, agreed_price, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [trade.tradeId, listing.id, order.id, trade.seller, trade.buyer, trade.zoneId, trade.quantityKwh, trade.agreedPrice, trade.status]);

        console.log('EVENT IS:', event);
        await client.query(`
          INSERT INTO trade_events (trade_id, event_type, event_data, previous_hash, event_hash)
          VALUES ($1, $2, $3, $4, $5)
        `, [trade.tradeId, event.eventType, event.eventData, event.previousHash, event.currentHash]);

        // Update listing & order
        listing.remaining_kwh = parseFloat(listing.remaining_kwh) - quantityKwh;
        order.quantity_kwh = parseFloat(order.quantity_kwh) - quantityKwh;

        if (listing.remaining_kwh <= 0) {
          listing.status = 'FILLED';
          await client.query(`UPDATE energy_listings SET remaining_kwh = 0, status = 'FILLED' WHERE id = $1`, [listing.id]);
        } else {
          await client.query(`UPDATE energy_listings SET remaining_kwh = $1 WHERE id = $2`, [listing.remaining_kwh, listing.id]);
        }

        if (order.quantity_kwh <= 0) {
          order.status = 'FILLED';
          await client.query(`UPDATE buy_orders SET status = 'FILLED' WHERE id = $1`, [order.id]);
        } else {
          await client.query(`UPDATE buy_orders SET quantity_kwh = $1 WHERE id = $2`, [order.quantity_kwh, order.id]);
        }

        matchedTrades.push(trade);

        if (order.status === 'FILLED') break; // Move to next order
      }
    }

    await client.query('COMMIT');
    return matchedTrades;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  matchTrades
};
