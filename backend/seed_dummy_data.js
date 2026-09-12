require('dotenv').config();
const db = require('./src/services/db.service');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const fs = require('fs');
const path = require('path');

function computeHash(data, prevHash = '0000000000000000000000000000000000000000000000000000000000000000') {
  return crypto.createHash('sha256').update(JSON.stringify(data) + prevHash).digest('hex');
}

async function seed() {
  console.log('🚀 Starting Comprehensive Dummy Data Seeding (75-100 items per entity table)...');
  const client = await db.getPool().connect();
  
  try {
    await client.query('BEGIN');

    // 1. Clean existing tables and recreate schema from schema.sql
    console.log('Clearing existing tables and recreating schema...');
    await client.query('DROP TABLE IF EXISTS audit_logs, user_requests, wallet_deposits, disputes, settlements, trade_events, trades, buy_orders, energy_listings, meter_readings, smart_meters, solar_assets, wallets, users, pricing_configs, grid_zones CASCADE');

    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('Schema created successfully.');

    // 2. Insert Grid Zones
    console.log('Seeding Grid Zones...');
    const zones = [
      { id: 'ZONE-1', name: 'Downtown Core', capacity: 500, load: 310, threshold: 0.85, status: 'NORMAL' },
      { id: 'ZONE-2', name: 'North Suburbs', capacity: 350, load: 180, threshold: 0.80, status: 'NORMAL' },
      { id: 'ZONE-3', name: 'Industrial Park', capacity: 750, load: 680, threshold: 0.90, status: 'CONGESTED' },
      { id: 'ZONE-4', name: 'East Coast Tech Belt', capacity: 600, load: 240, threshold: 0.85, status: 'NORMAL' }
    ];
    for (const z of zones) {
      await client.query(
        `INSERT INTO grid_zones (id, name, capacity_kw, current_load_kw, congestion_threshold, status) VALUES ($1, $2, $3, $4, $5, $6)`,
        [z.id, z.name, z.capacity, z.load, z.threshold, z.status]
      );
    }

    // 3. Insert Pricing Configs
    console.log('Seeding Pricing Configs...');
    for (const z of zones) {
      await client.query(
        `INSERT INTO pricing_configs (zone_id, floor_price, ceiling_price, elasticity_factor, congestion_multiplier, repricing_interval)
         VALUES ($1, 0.05, 0.35, 1.25, 1.15, 15)`,
        [z.id]
      );
    }

    // Password hash for all users: 'password123'
    const passwordHash = await bcrypt.hash('password123', 10);

    // 4. Create Users (~85 total users)
    console.log('Seeding Users...');
    const users = [];
    
    // 1 Admin
    const adminRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role, zone_id, status)
       VALUES ('System Admin', 'admin@solarlink.com', $1, 'admin', 'ZONE-1', 'ACTIVE') RETURNING *`,
      [passwordHash]
    );
    users.push(adminRes.rows[0]);

    // 35 Prosumers
    for (let i = 1; i <= 35; i++) {
      const zoneId = `ZONE-${(i % 4) + 1}`;
      const res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, zone_id, status)
         VALUES ($1, $2, $3, 'prosumer', $4, 'ACTIVE') RETURNING *`,
        [`Solar Prosumer ${i}`, `prosumer${i}@solarlink.com`, passwordHash, zoneId]
      );
      users.push(res.rows[0]);
    }

    // 35 Consumers
    for (let i = 1; i <= 35; i++) {
      const zoneId = `ZONE-${(i % 4) + 1}`;
      const res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, zone_id, status)
         VALUES ($1, $2, $3, 'consumer', $4, 'ACTIVE') RETURNING *`,
        [`Energy Consumer ${i}`, `consumer${i}@solarlink.com`, passwordHash, zoneId]
      );
      users.push(res.rows[0]);
    }

    // 8 Utility Companies (ACTIVE, PENDING, REJECTED)
    const utilityStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'PENDING', 'PENDING', 'PENDING', 'REJECTED', 'REJECTED'];
    for (let i = 1; i <= 8; i++) {
      const zoneId = `ZONE-${(i % 4) + 1}`;
      const status = utilityStatuses[i - 1];
      const res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, zone_id, status)
         VALUES ($1, $2, $3, 'utility', $4, $5) RETURNING *`,
        [`Grid Utility Corp ${i}`, `utility${i}@solarlink.com`, passwordHash, zoneId, status]
      );
      users.push(res.rows[0]);
    }

    // 6 Energy Regulators (ACTIVE, PENDING, REJECTED)
    const regulatorStatuses = ['ACTIVE', 'ACTIVE', 'PENDING', 'PENDING', 'REJECTED', 'REJECTED'];
    for (let i = 1; i <= 6; i++) {
      const zoneId = `ZONE-${(i % 4) + 1}`;
      const status = regulatorStatuses[i - 1];
      const res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, zone_id, status)
         VALUES ($1, $2, $3, 'regulator', $4, $5) RETURNING *`,
        [`State Energy Board ${i}`, `regulator${i}@solarlink.com`, passwordHash, zoneId, status]
      );
      users.push(res.rows[0]);
    }

    // 5. Create Wallets for all users
    console.log('Seeding Wallets...');
    for (const u of users) {
      const balance = u.role === 'admin' ? 10000 : parseFloat((Math.random() * 2000 + 100).toFixed(2));
      await client.query(`INSERT INTO wallets (user_id, balance) VALUES ($1, $2)`, [u.id, balance]);
    }

    // Filter users by role for relationship mapping
    const prosumers = users.filter(u => u.role === 'prosumer');
    const consumers = users.filter(u => u.role === 'consumer');
    const utilities = users.filter(u => u.role === 'utility');
    const regulators = users.filter(u => u.role === 'regulator');

    // 6. Create Solar Assets (~75 assets)
    console.log('Seeding Solar Assets & Smart Meters...');
    const solarAssets = [];
    const smartMeters = [];
    const panelTypes = ['SunPower Maxeon 400W', 'Tesla Solar Glass V3', 'Canadian Solar HiKu 450W', 'LG NeON R 380W', 'Jinko Solar Tiger Pro 540W'];
    const inverterTypes = ['SolarEdge SE7600H-US', 'Enphase IQ8+ Microinverter', 'Fronius Primo 6.0-1', 'SMA Sunny Boy 5.0'];

    let assetCount = 0;
    for (let pIdx = 0; pIdx < prosumers.length; pIdx++) {
      const p = prosumers[pIdx];
      // Create 2 assets for some prosumers to reach ~75 assets total
      const count = pIdx < 40 ? 2 : 1; 
      for (let a = 0; a < count && assetCount < 75; a++) {
        assetCount++;
        const capacity = parseFloat((Math.random() * 12 + 3).toFixed(1)); // 3.0 to 15.0 kW
        const panel = panelTypes[assetCount % panelTypes.length];
        const inverter = inverterTypes[assetCount % inverterTypes.length];
        const battery = assetCount % 2 === 0;

        const assetRes = await client.query(
          `INSERT INTO solar_assets (user_id, capacity_kw, panel_details, inverter_details, installation_date, battery_enabled)
           VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${assetCount * 3} days', $5) RETURNING *`,
          [p.id, capacity, panel, inverter, battery]
        );
        const asset = assetRes.rows[0];
        solarAssets.push(asset);

        // Smart Meter for each asset
        const meterRes = await client.query(
          `INSERT INTO smart_meters (asset_id, meter_type, status, last_reading_at)
           VALUES ($1, 'BIDIRECTIONAL', $2, NOW() - INTERVAL '${(assetCount % 12)} hours') RETURNING *`,
          [asset.id, assetCount % 10 === 0 ? 'OFFLINE' : 'ONLINE']
        );
        smartMeters.push(meterRes.rows[0]);
      }
    }

    // 7. Create Meter Readings (~100 readings)
    console.log('Seeding Meter Readings...');
    for (let i = 0; i < 100; i++) {
      const meter = smartMeters[i % smartMeters.length];
      const gen = parseFloat((Math.random() * 35 + 10).toFixed(2));
      const cons = parseFloat((Math.random() * 25 + 5).toFixed(2));
      const battC = parseFloat((Math.random() * 8).toFixed(2));
      const battD = parseFloat((Math.random() * 6).toFixed(2));
      
      await client.query(
        `INSERT INTO meter_readings (meter_id, generation_kwh, consumption_kwh, battery_charge_kwh, battery_discharge_kwh, timestamp)
         VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${i * 3} hours')`,
        [meter.id, gen, cons, battC, battD]
      );
    }

    // 8. Create Energy Listings (~80 listings)
    console.log('Seeding Energy Listings...');
    const listings = [];
    const listingStatuses = ['ACTIVE', 'ACTIVE', 'MATCHED', 'MATCHED', 'MATCHED', 'CANCELLED', 'EXPIRED'];
    
    for (let i = 1; i <= 80; i++) {
      const seller = prosumers[i % prosumers.length];
      const status = listingStatuses[i % listingStatuses.length];
      const qty = parseFloat((Math.random() * 40 + 10).toFixed(1));
      const rem = status === 'MATCHED' ? 0 : status === 'ACTIVE' ? parseFloat((qty * (0.5 + Math.random() * 0.5)).toFixed(1)) : qty;
      const price = parseFloat((Math.random() * 0.08 + 0.12).toFixed(2)); // $0.12 - $0.20/kWh

      const res = await client.query(
        `INSERT INTO energy_listings (seller_id, zone_id, quantity_kwh, remaining_kwh, asking_price, status, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '${i * 4} hours', NOW() + INTERVAL '${7 - (i % 5)} days') RETURNING *`,
        [seller.id, seller.zone_id, qty, rem, price, status]
      );
      listings.push(res.rows[0]);
    }

    // 9. Create Buy Orders (~80 buy orders)
    console.log('Seeding Buy Orders...');
    const buyOrders = [];
    const orderStatuses = ['OPEN', 'OPEN', 'MATCHED', 'MATCHED', 'MATCHED', 'CANCELLED'];

    for (let i = 1; i <= 80; i++) {
      const buyer = consumers[i % consumers.length];
      const status = orderStatuses[i % orderStatuses.length];
      const qty = parseFloat((Math.random() * 35 + 10).toFixed(1));
      const maxPrice = parseFloat((Math.random() * 0.08 + 0.14).toFixed(2)); // $0.14 - $0.22/kWh

      const res = await client.query(
        `INSERT INTO buy_orders (buyer_id, zone_id, quantity_kwh, max_price, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${i * 3} hours') RETURNING *`,
        [buyer.id, buyer.zone_id, qty, maxPrice, status]
      );
      buyOrders.push(res.rows[0]);
    }

    // 10. Create Trades (~85 trades) & Trade Events with SHA-256 Hashchain
    console.log('Seeding Trades, Blockchain Ledger Events, & Settlements...');
    const tradeStatuses = [
      'SETTLED', 'SETTLED', 'SETTLED',
      'VERIFIED', 'VERIFIED',
      'DELIVERED', 'LOCKED', 'MATCHED',
      'DISPUTED', 'DISPUTED', 'DISPUTED', 'DISPUTED', 'DISPUTED',
      'CANCELLED'
    ];

    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 1; i <= 85; i++) {
      const listing = listings[(i - 1) % listings.length];
      const order = buyOrders[(i - 1) % buyOrders.length];
      const seller = prosumers[i % prosumers.length];
      const buyer = consumers[i % consumers.length];
      const zoneId = seller.zone_id;
      const status = tradeStatuses[i % tradeStatuses.length];

      const qty = parseFloat((Math.random() * 25 + 5).toFixed(1));
      const agreedPrice = parseFloat((Math.random() * 0.05 + 0.13).toFixed(4));
      const platformFee = parseFloat((qty * agreedPrice * 0.02).toFixed(4));
      const gridFee = parseFloat((qty * agreedPrice * 0.03).toFixed(4));
      const fees = { platform_fee: platformFee, grid_fee: gridFee };

      const tradeRes = await client.query(
        `INSERT INTO trades (listing_id, buy_order_id, seller_id, buyer_id, zone_id, quantity_kwh, agreed_price, fees, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '${i * 4} hours') RETURNING *`,
        [listing.id, order.id, seller.id, buyer.id, zoneId, qty, agreedPrice, JSON.stringify(fees), status]
      );
      const trade = tradeRes.rows[0];

      // Add Trade Events Hashchain (TradeCreated -> TradeLocked -> DeliveryRecorded -> TradeVerified -> TradeSettled)
      const eventTypes = ['TradeCreated'];
      if (['LOCKED', 'DELIVERED', 'VERIFIED', 'SETTLED', 'DISPUTED'].includes(status)) eventTypes.push('TradeLocked');
      if (['DELIVERED', 'VERIFIED', 'SETTLED', 'DISPUTED'].includes(status)) eventTypes.push('DeliveryRecorded');
      if (['VERIFIED', 'SETTLED'].includes(status)) eventTypes.push('TradeVerified');
      if (status === 'SETTLED') eventTypes.push('TradeSettled');
      if (status === 'DISPUTED') eventTypes.push('DisputeOpened');

      for (let eIdx = 0; eIdx < eventTypes.length; eIdx++) {
        const evtType = eventTypes[eIdx];
        const eventData = {
          trade_id: trade.id,
          seller_id: seller.id,
          buyer_id: buyer.id,
          quantity_kwh: qty,
          agreed_price: agreedPrice,
          event_type: evtType
        };
        const eventHash = computeHash(eventData, previousHash);

        await client.query(
          `INSERT INTO trade_events (trade_id, event_type, event_data, timestamp, previous_hash, event_hash)
           VALUES ($1, $2, $3, NOW() - INTERVAL '${i * 4 - eIdx} hours', $4, $5)`,
          [trade.id, evtType, JSON.stringify(eventData), previousHash, eventHash]
        );
        previousHash = eventHash;
      }

      // Add Settlement
      const gross = parseFloat((qty * agreedPrice).toFixed(4));
      const sellerCredit = parseFloat((gross - platformFee - gridFee).toFixed(4));
      const buyerDebit = parseFloat(gross.toFixed(4));
      const settlementStatus = status === 'SETTLED' ? 'SETTLED' : status === 'DISPUTED' ? 'REFUNDED' : 'PENDING';
      const refundAmt = status === 'DISPUTED' ? parseFloat((gross * 0.3).toFixed(4)) : 0;

      await client.query(
        `INSERT INTO settlements (trade_id, gross_amount, platform_fee, grid_fee, refund_amount, seller_credit, buyer_debit, status, settled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${status === 'SETTLED' ? 'NOW()' : 'NULL'})`,
        [trade.id, gross, platformFee, gridFee, refundAmt, sellerCredit, buyerDebit, settlementStatus]
      );

      // Add Dispute for DISPUTED and a subset of trades to reach ~75 dispute records overall
      if (status === 'DISPUTED' || (i <= 75 && (i % 4 !== 0))) {
        const contracted = qty;
        const shortfallPct = parseFloat((10 + (i % 30)).toFixed(1));
        const delivered = parseFloat((qty * (1 - shortfallPct / 100)).toFixed(1));
        const dispRefund = parseFloat((gross * (shortfallPct / 100)).toFixed(4));
        const resolutions = [
          'Shortfall verified by smart meter audit. Partial refund issued to consumer.',
          'Grid delivery latency confirmed. Penalty deducted from seller credit.',
          'Dispute resolved by automatic SLA compensation.',
          'Pending administrative review by Energy Regulator.'
        ];
        const resText = status === 'DISPUTED' ? 'Pending administrative review by Energy Regulator.' : resolutions[i % resolutions.length];

        await client.query(
          `INSERT INTO disputes (trade_id, contracted_kwh, delivered_kwh, shortfall_percent, resolution, refund_amount, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '${i * 2} hours')`,
          [trade.id, contracted, delivered, shortfallPct, resText, dispRefund]
        );
      }
    }

    // 11. Create Wallet Deposits (~80 deposit requests)
    console.log('Seeding Wallet Deposit Requests...');
    const depositStatuses = ['PENDING', 'APPROVED', 'APPROVED', 'REJECTED'];
    for (let i = 1; i <= 80; i++) {
      const user = i % 2 === 0 ? consumers[i % consumers.length] : prosumers[i % prosumers.length];
      const status = depositStatuses[i % depositStatuses.length];
      const amount = parseFloat((Math.random() * 450 + 50).toFixed(2));
      const reviewer = status === 'PENDING' ? null : adminRes.rows[0].id;

      await client.query(
        `INSERT INTO wallet_deposits (user_id, amount, status, reviewed_by, created_at, reviewed_at)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${i * 5} hours', ${status !== 'PENDING' ? 'NOW()' : 'NULL'})`,
        [user.id, amount, status, reviewer]
      );
    }

    // 12. Create User Requests (~75 registration approval requests)
    console.log('Seeding User Requests...');
    const reqStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
    for (let i = 0; i < users.length && i < 75; i++) {
      const u = users[i];
      const status = u.status === 'ACTIVE' ? 'APPROVED' : u.status;
      const reviewer = status === 'PENDING' ? null : adminRes.rows[0].id;
      const reason = status === 'APPROVED' ? 'Identity & Grid Location Verified' : status === 'REJECTED' ? 'Incomplete grid zone documentation provided' : null;

      const assetInfo = u.role === 'prosumer' ? { capacity_kw: 5.5, panel: 'Tesla V3' } : null;

      await client.query(
        `INSERT INTO user_requests (user_id, role, zone_id, asset_details, status, reviewed_by, review_reason, created_at, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '${i * 6} hours', ${status !== 'PENDING' ? 'NOW()' : 'NULL'})`,
        [u.id, u.role, u.zone_id, JSON.stringify(assetInfo), status, reviewer, reason]
      );
    }

    // 13. Create Audit Logs (~100 audit entries)
    console.log('Seeding Audit Logs...');
    const auditEvents = [
      { event: 'USER_REGISTERED', entity: 'user' },
      { event: 'USER_LOGIN', entity: 'user' },
      { event: 'LISTING_CREATED', entity: 'energy_listing' },
      { event: 'BUY_ORDER_CREATED', entity: 'buy_order' },
      { event: 'TRADE_MATCHED', entity: 'trade' },
      { event: 'TRADE_SETTLED', entity: 'trade' },
      { event: 'DISPUTE_RAISED', entity: 'dispute' },
      { event: 'DEPOSIT_APPROVED', entity: 'wallet_deposit' },
      { event: 'USER_REQUEST_APPROVED', entity: 'user_request' },
      { event: 'USER_REQUEST_REJECTED', entity: 'user_request' }
    ];

    for (let i = 1; i <= 100; i++) {
      const u = users[i % users.length];
      const evt = auditEvents[i % auditEvents.length];
      const status = i % 15 === 0 ? 'REJECTED' : 'SUCCESS';

      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, event_type, entity_type, entity_id, status, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - INTERVAL '${i * 2} hours')`,
        [
          u.id, u.role, evt.event, evt.entity, `ENT-${1000 + i}`, status,
          JSON.stringify({ note: `Automated system log for ${evt.event}`, index: i }),
          `192.168.1.${10 + (i % 50)}`
        ]
      );
    }

    await client.query('COMMIT');
    console.log('✅ SEEDING COMPLETE! Successfully populated 75-100 entries per entity table!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ SEEDING FAILED:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
