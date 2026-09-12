# Product Requirements Document (PRD)

## 1. Product

**SolarLink — Dynamic P2P Renewable Energy Trading Marketplace**

## 2. Problem

Traditional metering can report generation and consumption without providing a real-time marketplace. SolarLink creates a quotation-to-settlement flow where local surplus can be dynamically priced, matched, verified, and settled.

## 3. Objective

Build a working hackathon prototype demonstrating:

- Real-time surplus listing
- Dynamic price calculation
- Zone-aware matching
- Grid-aware trading
- Tamper-evident trade records
- Delivery verification
- Settlement and dispute handling
- Utility/regulator visibility

## 4. Users

### Prosumer
Registers solar assets, links a meter, declares/auto-lists surplus, and receives earnings.

### Consumer
Browses local energy, receives live quotes, places buy orders, and tracks savings.

### Utility/Grid Operator
Monitors zone load/congestion and can trigger throttling or curtailment.

### Regulator
Views restricted compliance information and audits trades.

### Admin
Configures zones, pricing rules, fees, contracts, onboarding, and platform settings.

## 5. Functional Requirements

### FR-01 Authentication
Users can sign up/login. Role-based permissions are required.

### FR-02 Asset Setup
Prosumer can register solar capacity and connect a simulated meter.

### FR-03 Surplus Detection
System calculates surplus from simulated generation and consumption.

`surplus = max(generation - consumption - battery_reserved_energy, 0)`

### FR-04 Energy Listing
Surplus can be automatically or manually listed.

### FR-05 Dynamic Pricing
Price must remain inside configured floor and ceiling and respond to supply, demand, and congestion.

### FR-06 Matching
Buy orders must be matched with available supply, prioritizing the same/electrically nearby zone and shorter transmission distance.

### FR-07 Trade Lifecycle
`MATCHED → LOCKED → DELIVERED → VERIFIED → SETTLED`

Possible alternate state: `DISPUTED`.

### FR-08 Congestion
When a zone approaches/exceeds capacity, trades are surcharged, throttled, or paused according to configuration.

### FR-09 Settlement
Verified trades debit the consumer and credit the prosumer.

### FR-10 Dispute
A delivery shortfall can trigger a partial refund/credit according to configured rules.

### FR-11 Dashboards
Market health, energy flow, earnings/savings, congestion, and compliance information must be visible to authorized users.

## 6. Non-Functional Requirements

- Realtime updates for important market values
- Role-based access control
- Tamper-evident trade history
- Deterministic pricing and matching
- Clear audit trail
- Demo-friendly seed data
- Modular architecture

## 7. MVP Scope

Required:

- Simulated meter
- At least two zones
- Dynamic pricing
- Matching
- Congestion scenario
- Trade lifecycle
- Settlement
- Dashboard
- Tamper-evident ledger

Optional:

- Real smart meter
- Production blockchain
- Multi-region interoperability
- Advanced ML forecasting

## 8. Success Criteria

A five-minute demo should prove at least two complete flows and include congestion or dispute behavior.
