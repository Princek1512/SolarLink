# Database Design

## Main Tables

### users
- id
- name
- email
- password_hash
- role
- zone_id
- status
- created_at

### solar_assets
- id
- user_id
- capacity_kw
- panel_details
- inverter_details
- installation_date
- battery_enabled

### smart_meters
- id
- asset_id
- meter_type
- status
- last_reading_at

### meter_readings
- id
- meter_id
- generation_kwh
- consumption_kwh
- battery_charge_kwh
- battery_discharge_kwh
- timestamp

### grid_zones
- id
- name
- capacity_kw
- current_load_kw
- congestion_threshold
- status

### energy_listings
- id
- seller_id
- zone_id
- quantity_kwh
- remaining_kwh
- asking_price
- status
- created_at
- expires_at

### buy_orders
- id
- buyer_id
- zone_id
- quantity_kwh
- max_price
- status
- created_at

### trades
- id
- listing_id
- buy_order_id
- seller_id
- buyer_id
- zone_id
- quantity_kwh
- agreed_price
- fees
- status
- created_at

### trade_events
- id
- trade_id
- event_type
- event_data
- timestamp
- previous_hash
- event_hash

### wallets
- id
- user_id
- balance

### settlements
- id
- trade_id
- gross_amount
- platform_fee
- grid_fee
- refund_amount
- seller_credit
- buyer_debit
- status
- settled_at

### disputes
- id
- trade_id
- contracted_kwh
- delivered_kwh
- shortfall_percent
- resolution
- refund_amount
- created_at

### pricing_configs
- id
- zone_id
- floor_price
- ceiling_price
- elasticity_factor
- congestion_multiplier
- repricing_interval

## Relationships

`User → SolarAsset → SmartMeter → MeterReading`

`User → EnergyListing`

`User → BuyOrder`

`Listing + BuyOrder → Trade → TradeEvents`

`Trade → Settlement`

`Trade → Dispute`

`GridZone → Listings / Orders / Trades / PricingConfig`
