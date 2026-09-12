-- SolarLink Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. grid_zones
CREATE TABLE grid_zones (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    capacity_kw NUMERIC NOT NULL,
    current_load_kw NUMERIC DEFAULT 0,
    congestion_threshold NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'NORMAL'
);

-- 2. users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('prosumer', 'consumer', 'utility', 'regulator', 'admin')),
    zone_id VARCHAR(50) REFERENCES grid_zones(id),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. wallets
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC DEFAULT 0
);

-- 4. solar_assets
CREATE TABLE solar_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    capacity_kw NUMERIC NOT NULL,
    panel_details TEXT,
    inverter_details TEXT,
    installation_date DATE,
    battery_enabled BOOLEAN DEFAULT FALSE
);

-- 5. smart_meters
CREATE TABLE smart_meters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES solar_assets(id) ON DELETE CASCADE,
    meter_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    last_reading_at TIMESTAMP WITH TIME ZONE
);

-- 6. meter_readings
CREATE TABLE meter_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meter_id UUID NOT NULL REFERENCES smart_meters(id) ON DELETE CASCADE,
    generation_kwh NUMERIC DEFAULT 0,
    consumption_kwh NUMERIC DEFAULT 0,
    battery_charge_kwh NUMERIC DEFAULT 0,
    battery_discharge_kwh NUMERIC DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. energy_listings
CREATE TABLE energy_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES users(id),
    zone_id VARCHAR(50) REFERENCES grid_zones(id),
    quantity_kwh NUMERIC NOT NULL,
    remaining_kwh NUMERIC NOT NULL,
    asking_price NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 8. buy_orders
CREATE TABLE buy_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id UUID NOT NULL REFERENCES users(id),
    zone_id VARCHAR(50) REFERENCES grid_zones(id),
    quantity_kwh NUMERIC NOT NULL,
    max_price NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. trades
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES energy_listings(id),
    buy_order_id UUID REFERENCES buy_orders(id),
    seller_id UUID NOT NULL REFERENCES users(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    zone_id VARCHAR(50) REFERENCES grid_zones(id),
    quantity_kwh NUMERIC NOT NULL,
    agreed_price NUMERIC NOT NULL,
    fees JSONB,
    status VARCHAR(50) NOT NULL CHECK (status IN ('MATCHED', 'LOCKED', 'DELIVERED', 'VERIFIED', 'SETTLED', 'DISPUTED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. trade_events
CREATE TABLE trade_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    previous_hash VARCHAR(255),
    event_hash VARCHAR(255) NOT NULL
);

-- 11. settlements
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    gross_amount NUMERIC NOT NULL,
    platform_fee NUMERIC NOT NULL,
    grid_fee NUMERIC NOT NULL,
    refund_amount NUMERIC DEFAULT 0,
    seller_credit NUMERIC NOT NULL,
    buyer_debit NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    settled_at TIMESTAMP WITH TIME ZONE
);

-- 12. disputes
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    contracted_kwh NUMERIC NOT NULL,
    delivered_kwh NUMERIC NOT NULL,
    shortfall_percent NUMERIC NOT NULL,
    resolution TEXT,
    refund_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. pricing_configs
CREATE TABLE pricing_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id VARCHAR(50) NOT NULL REFERENCES grid_zones(id) UNIQUE,
    floor_price NUMERIC NOT NULL,
    ceiling_price NUMERIC NOT NULL,
    elasticity_factor NUMERIC DEFAULT 1.0,
    congestion_multiplier NUMERIC DEFAULT 0,
    repricing_interval INTEGER DEFAULT 60000
);

-- 14. wallet_deposits
CREATE TABLE IF NOT EXISTS wallet_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 15. user_requests (registration approval queue)
CREATE TABLE IF NOT EXISTS user_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    zone_id VARCHAR(50) REFERENCES grid_zones(id),
    asset_details JSONB,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES users(id),
    review_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 16. audit_logs (append-only platform audit trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id),
    actor_role VARCHAR(50),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    status VARCHAR(50),
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Enforce append-only: revoke UPDATE/DELETE at app level (no triggers needed for MVP)
