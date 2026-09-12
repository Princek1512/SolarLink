# SolarLink — IoT / Smart Meter Simulator

Implements `IOT_METER.md`: Member 2's ownership area. Zero external
dependencies — built on Node's built-ins (`http`, `https`), so there's
nothing to `npm install` before the demo.

## What's here

```
src/
  simulator/scenarios.js        # the 6 controllable scenarios from the doc
  simulator/MeterSimulator.js   # one simulated meter: generation/consumption curves, battery
  simulator/SimulatorManager.js # registry of meters, tick scheduling, push-to-backend
  services/SurplusService.js    # turns latest readings into listing-ready records
  server.js                     # plain-Node REST API
test/
  demo.js                       # proves all 4 required demo scenarios deterministically
```

## Run the demo

```bash
node test/demo.js
```

Walks through the exact four things `IOT_METER.md`'s "Demo Requirement"
asks for, deterministically (fixed times of day, not real-time):

1. **Surplus** — a prosumer meter at solar noon, showing a small battery
   filling up first, then extra surplus becoming sellable once it's full
   (this is the "reserve battery energy according to configured priority"
   behavior).
2. **High demand** — a consumer meter at evening peak under the
   `HIGH_DEMAND` scenario.
3. **Congestion** — three meters in the same zone all forced into the
   `CONGESTION` scenario, with their combined load printed as what you'd
   feed into the congestion engine's zone-threshold check.
4. **Delivery shortfall** — the same meter reporting 5 kWh delivered
   normally vs. only 4 kWh (20% short) under `DELIVERY_SHORTFALL`, with the
   exact call you'd make into the blockchain layer's `recordDelivery()` to
   demo the dispute path end to end.

## Run the REST server

```bash
node src/server.js
# optionally: PORT=4100 READINGS_PUSH_URL=http://localhost:5000/api/meter-readings node src/server.js
```

```bash
# Register a meter
curl -X POST localhost:4100/api/meters -H "content-type: application/json" \
  -d '{"assetId":"prosumer_zone2_ravi","zoneId":2,"type":"PROSUMER","capacityKw":5,"hasBattery":true,"batteryCapacityKwh":10}'

# Start it ticking every 5s (demo speed — real deployments would use minutes)
curl -X POST localhost:4100/api/meters/prosumer_zone2_ravi/start -H "content-type: application/json" -d '{"tickEveryMs":5000}'

# Force a scenario
curl -X POST localhost:4100/api/meters/prosumer_zone2_ravi/scenario -H "content-type: application/json" -d '{"scenario":"CONGESTION"}'

# Read data
curl localhost:4100/api/meters/prosumer_zone2_ravi/latest
curl localhost:4100/api/meters/prosumer_zone2_ravi/readings?limit=20
curl localhost:4100/api/meters/prosumer_zone2_ravi/surplus
curl localhost:4100/api/market/summary     # zone-anonymized, like the marketplace cards
curl localhost:4100/api/market/listings

# Delivery-shortfall check for an active trade
curl -X POST localhost:4100/api/meters/prosumer_zone2_ravi/delivered -H "content-type: application/json" -d '{"committedKwh":5}'
```

Full endpoint list: `POST /api/meters`, `GET /api/meters`, `GET /api/meters/:id`,
`POST /api/meters/:id/start`, `POST /api/meters/:id/stop`,
`POST /api/meters/:id/tick`, `POST /api/meters/:id/scenario`,
`GET /api/meters/:id/latest`, `GET /api/meters/:id/readings`,
`GET /api/meters/:id/surplus`, `POST /api/meters/:id/delivered`,
`GET /api/market/summary`, `GET /api/market/listings`, `GET /api/scenarios`.

## Wiring into the rest of the team's work

- **Backend (Member 1):** set `READINGS_PUSH_URL` to Member 1's meter-reading
  endpoint once it exists, and every tick auto-POSTs there. Or skip HTTP
  entirely and `require('./simulator/SimulatorManager')` straight into the
  Express app.
- **Pricing/matching (Member 2's other services):** `SurplusService.getAllListableSurplus()` /
  `getZoneSummaries()` give exactly what the pricing engine needs as input —
  it decides price, this module just reports "how much is available."
- **Blockchain (already built):** at delivery-verification time, call
  `meter.getDeliveredKwh(committedKwh)` and pass the result straight into
  `BlockchainAdapter.recordDelivery(tradeId, { deliveredKwh, meterReadings })`
  from the `solarlink-blockchain` module — flip a meter's scenario to
  `DELIVERY_SHORTFALL` beforehand to demo the dispute path live.

## Design notes / how it maps to IOT_METER.md

- **Six controls** (`scenarios.js`): `NORMAL`, `HIGH_GENERATION`,
  `LOW_GENERATION`, `HIGH_DEMAND`, `CONGESTION`, `DELIVERY_SHORTFALL` —
  exactly the list under "Simulator Controls."
- **Generation/consumption curves**: daylight-shaped bell curve for solar
  generation (zero outside ~6am–7pm, peaking at solar noon), and a
  baseline-plus-morning/evening-peak curve for consumption — so scenario
  changes are visible on top of a believable daily shape, not flat numbers.
  Magnitudes are tuned to land near the doc's own worked example (~3–4 kWh
  per reading), not literal kW-to-kWh physics — this is a demo tool, not a
  power-systems model.
- **Battery**: `hasBattery` + `batteryCapacityKwh` + `batteryPriority`
  (`charge_first` charges from surplus before anything is listed,
  `sell_first` lists all surplus and leaves the battery untouched), per
  "reserve battery energy according to configured priority."
- **Congestion is deliberately NOT computed here** — per
  `BLOCKCHAIN_DESIGN.md` §19 and the project plan's separation of concerns,
  this module only *produces* the load data; a separate congestion engine
  (also Member 2's, but not yet built) decides NORMAL/ELEVATED/CONSTRAINED
  from the aggregate zone numbers.
- **Delivery shortfall is a separate mechanism from the tick loop**
  (`getDeliveredKwh`) because a real shortfall is about what's reported
  against an already-committed trade quantity, not the raw meter reading
  itself — this keeps it a clean, explicit call at the point a trade is
  actually being verified.
