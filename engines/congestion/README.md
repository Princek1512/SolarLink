# SolarLink — Grid Congestion Management

Implements `CONGESTION_MANAGEMENT.md` in full, and closes the gap flagged in
`MATCHING_PRICE.md` ("Where the Congestion Level Comes From") — the piece
that turns zone capacity/load/threshold into the `NORMAL` / `ELEVATED` /
`CONSTRAINED` string that `solarlink-pricing-engine`'s `CongestionLevels.js`
consumes but never produces. Zero external dependencies — built on Node's
built-ins, so there's nothing to `npm install`.

## What's here

```
src/
  engine/LoadTracker.js       # per-zone committed load, driven by trade lifecycle
  engine/CongestionEngine.js  # capacity/threshold config, NORMAL/ELEVATED/CONSTRAINED, audit log
  bridge/PricingBridge.js     # pushes congestion level into pricing's inputs; matching pre-check
  server.js                   # plain-Node REST API
test/
  demo.js                     # proves CONGESTION_MANAGEMENT.md's flow + the matching pre-check
```

## Run the demo

```bash
node test/demo.js
```

Walks through, in order:

1. **Inputs** — a zone configured with `capacityKwh` / `thresholdKwh`.
2. **Status transitions** — load rising through `MATCHED` → `LOCKED` →
   `DELIVERED` trades, crossing from `NORMAL` to `ELEVATED` to `CONSTRAINED`
   exactly as load crosses threshold, then capacity.
3. **Projected-load pre-check** — `checkNewTrade()` answering "what would
   this order do to the zone's status?" without reserving anything, per
   `MATCHING_PRICE.md`'s requirement that congestion be checked against
   *current + this order*, not a stale snapshot.
4. **"When congestion clears, eligible trading can resume"** — releasing
   trades drops load and status back down.
5. **Hackathon-MVP override** — forcing a status for a demo without wiring
   up real load.
6. **The bridge** — pushing a congestion evaluation into a (fake, for the
   demo) `PricingScheduler.pushInputs()`, and a matching-engine-style
   pre-check that resolves straight to a `wouldAllow` boolean.
7. **Audit log** — every `evaluate()` call kept for the same auditability
   reason as pricing rule 5.

## Run the REST server

```bash
node src/server.js   # listens on :4300
```

```bash
# Configure a zone's capacity/threshold
curl -X POST localhost:4300/api/zones -H "content-type: application/json" \
  -d '{"zoneId":2,"capacityKwh":100,"thresholdKwh":70}'

# Sync a trade's status into the load tracker (call after every
# BlockchainAdapter lifecycle call: createTrade, lockTrade, recordDelivery,
# cancelTrade, settleTrade, resolveDispute)
curl -X POST localhost:4300/api/zones/2/trades -H "content-type: application/json" \
  -d '{"tradeId":"t1","quantityKwh":40,"status":"MATCHED"}'

# Current load + active trades
curl localhost:4300/api/zones/2/load

# Current status (no projection)
curl localhost:4300/api/zones/2/status

# Project a candidate order's quantity, read-only
curl -X POST localhost:4300/api/zones/2/check -H "content-type: application/json" \
  -d '{"requestedQuantityKwh":35}'

# Hackathon-demo manual override
curl -X POST localhost:4300/api/zones/2/override -H "content-type: application/json" -d '{"level":"CONSTRAINED"}'
curl -X DELETE localhost:4300/api/zones/2/override

# Audit trail
curl localhost:4300/api/zones/2/audit
```

## Wiring into the rest of the team's work

- **Load input**: call `loadTracker.sync(trade)` (or hit
  `POST /api/zones/:id/trades`) every time a trade's status changes in
  `BlockchainAdapter` — `createTrade`, `lockTrade`, `recordDelivery`,
  `cancelTrade`, `settleTrade`, and `resolveDispute` all return
  `{ trade, ... }`; just forward `trade` in. "Active load" is defined as
  `MATCHED` / `LOCKED` / `DELIVERED` (see `LoadTracker.js`'s header comment
  for the reasoning) — everything else releases capacity.
- **Pricing**: use `PricingBridge.syncZone(zoneId, { supplyKwh, demandKwh })`
  wherever you're already calling `PricingScheduler.pushInputs` or
  `POST /pricing-engine/api/zones/:id/inputs` — the bridge computes
  congestion first and folds it into the same call, so pricing always sees
  a consistent `congestionLevel`.
- **Matching**: call `PricingBridge.precheckTrade(zoneId, requestedQuantityKwh)`
  (or `POST /api/zones/:id/check`) before creating any trade — this is the
  concrete implementation of `MATCHING_PRICE.md`'s "load must be evaluated
  per candidate order, before matching commits it." Only *after* the trade
  is actually created should the matching engine call
  `loadTracker.sync()`/`reserve()` to commit the load.
- **Congestion level → surcharge/tradeAllowed**: this engine deliberately
  does **not** duplicate that mapping — `CongestionLevels.js` in
  `solarlink-pricing-engine` already owns it. Pass its
  `getCongestionLevel(level).tradeAllowed` in as `PricingBridge`'s
  `resolveTradeAllowed` function (see `test/demo.js`'s `FakePricingScheduler`
  section for the shape) so there's exactly one place that decides what a
  given level actually means.

## Design notes

- **Load tracking is lifecycle-driven, not manually maintained.** Rather
  than asking every caller to remember to add/subtract kWh, `sync()` takes
  a full trade record and decides reserve-vs-release from its `status`, so
  calling it repeatedly (e.g. once per `BlockchainAdapter` call) is always
  safe and correct.
- **Status computation is a pure function of capacity/threshold/load**
  (`_classify`), same "lookup, not a calculation you hide inside a bigger
  function" spirit as `CongestionLevels.js` on the pricing side.
- **Projected load, not just current load**, is what `evaluate()` and
  `checkNewTrade()` actually classify against — this is what prevents a
  burst of concurrent orders from each passing a stale `NORMAL` check and
  jointly overshooting capacity (see `MATCHING_PRICE.md`).
- **Manual override exists for demo purposes only** and is clearly flagged
  in every `evaluate()` result (`overridden: true`) so it's never silently
  mistaken for a real load-derived status.
- **Dependencies are injected, not required directly** (`PricingBridge`
  takes `pricingScheduler` and `resolveTradeAllowed` as constructor args)
  — this repo has no hard path dependency on
  `solarlink-pricing-engine`'s folder location.
- **Audit log is append-only and unbounded for the life of the process**,
  same tradeoff `solarlink-pricing-engine` makes and flags for the same
  reason — flush it to the backend's database for a long-running demo.
