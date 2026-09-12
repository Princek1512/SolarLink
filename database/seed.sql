-- SolarLink Demo Seed Data

-- 1. grid_zones
INSERT INTO grid_zones (id, name, capacity_kw, current_load_kw, congestion_threshold, status) VALUES
('ZONE-1', 'Downtown Core', 10000, 5000, 8000, 'NORMAL'),
('ZONE-2', 'North Suburbs', 5000, 2000, 4000, 'NORMAL');

-- 2. users
-- Password hash for 'password123' (bcrypt hash)
INSERT INTO users (id, name, email, password_hash, role, zone_id, status) VALUES
('11111111-1111-1111-1111-111111111111', 'Admin User', 'admin@solarlink.com', '$2b$10$.UtY9ugCMB7E.cOaE9nMRObQQ6KGCGSXR92B7eQt99puBcwj.V9x2', 'admin', NULL, 'ACTIVE'),
('22222222-2222-2222-2222-222222222222', 'Alice Prosumer', 'alice@example.com', '$2b$10$.UtY9ugCMB7E.cOaE9nMRObQQ6KGCGSXR92B7eQt99puBcwj.V9x2', 'prosumer', 'ZONE-1', 'ACTIVE'),
('33333333-3333-3333-3333-333333333333', 'Bob Consumer', 'bob@example.com', '$2b$10$.UtY9ugCMB7E.cOaE9nMRObQQ6KGCGSXR92B7eQt99puBcwj.V9x2', 'consumer', 'ZONE-1', 'ACTIVE'),
('44444444-4444-4444-4444-444444444444', 'Charlie Prosumer', 'charlie@example.com', '$2b$10$.UtY9ugCMB7E.cOaE9nMRObQQ6KGCGSXR92B7eQt99puBcwj.V9x2', 'prosumer', 'ZONE-2', 'ACTIVE');

-- 3. wallets
INSERT INTO wallets (user_id, balance) VALUES
('11111111-1111-1111-1111-111111111111', 100000),
('22222222-2222-2222-2222-222222222222', 100),
('33333333-3333-3333-3333-333333333333', 500),
('44444444-4444-4444-4444-444444444444', 200);

-- 4. pricing_configs
INSERT INTO pricing_configs (zone_id, floor_price, ceiling_price, elasticity_factor, congestion_multiplier, repricing_interval) VALUES
('ZONE-1', 0.05, 0.50, 1.2, 0.10, 60000),
('ZONE-2', 0.04, 0.40, 1.1, 0.05, 60000);

-- 5. solar_assets
INSERT INTO solar_assets (id, user_id, capacity_kw, panel_details, inverter_details, battery_enabled) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 10.5, 'SunPower 400W x 26', 'SolarEdge SE10000H', TRUE),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 5.0, 'LG 350W x 14', 'Enphase IQ7', FALSE);

-- 6. smart_meters
INSERT INTO smart_meters (id, asset_id, meter_type, status) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PROSUMER', 'ACTIVE'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'PROSUMER', 'ACTIVE');
