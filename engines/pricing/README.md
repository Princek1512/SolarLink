# SolarLink — Dynamic Pricing Engine

Implements `DYNAMIC_PRICING.md` in full. Zero external dependencies —
built on Node's built-ins, so there's nothing to `npm install`.

## What's here

```
src/
  engine/formulas.js          # demand-pressure + market-price formulas — swappable, not hardcoded
  engine/CongestionLevels.js  # NORMAL / ELEVATED / CONSTRAINED — surcharge + trade eligibility
  engine/PricingEngine.js     # per-zone bands, computeQuote(), audit log
  scheduler/PricingScheduler.js # interval-based + change-triggered recompute
  server.js                   # plain-Node REST API
test/
  demo.js                     # proves all 5 rules + the configurable-formula requirement
```

## Run the demo

```bash
node test/demo.js
```

Walks through, in order:

1. The doc's own worked example (floor ₹6.00 / ceiling ₹8.50): high surplus
   pushes price toward floor, high demand pushes it toward ceiling.
2. **Rule 1 & 2** — extreme supply/demand imbalances still clamp exactly at
   the floor or ceiling, never past it.
3. **Rule 4** — the same supply/demand quoted under `NORMAL`, `ELEVATED`,
   and `CONSTRAINED` congestion: price rises with the surcharge, and
   `CONSTRAINED` flags `tradeAllowed: false` for the matching engine to
   respect.
4. **Rule 3** — a scheduler tick loop, then a small (5%) demand change that
   correctly waits for the next tick, followed by a large (double) demand
   change that triggers an immediate recompute.
5. **Rule 5** — printing the stored audit log entries, each with the exact
   inputs that produced that quote.
6. A second engine instance built with a **different formula function**
   passed into the constructor, proving the model isn't hardcoded — same
   inputs, different (correctly different) price.

## Run the REST server

```bash
node src/server.js   # listens on :4200
```

```bash
# Configure a zone's pricing band
curl -X POST localhost:4200/api/zones -H "content-type: application/json" \
  -d '{"zoneId":2,"floor":6.0,"ceiling":8.5,"elasticityFactor":1.5,"repricingIntervalMs":60000}'

# Get an immediate quote
curl -X POST localhost:4200/api/zones/2/quote -H "content-type: application/json" \
  -d '{"supplyKwh":2,"demandKwh":9,"congestionLevel":"ELEVATED"}'

# Last quote / full audit trail
curl localhost:4200/api/zones/2/quote
curl localhost:4200/api/zones/2/audit

# Push live inputs — recomputes immediately only if the change is "major"
curl -X POST localhost:4200/api/zones/2/inputs -H "content-type: application/json" \
  -d '{"supplyKwh":3,"demandKwh":12,"congestionLevel":"NORMAL"}'

# Start/stop the interval-based re-pricing loop (uses whatever was last posted to /inputs)
curl -X POST localhost:4200/api/zones/2/schedule/start
curl -X POST localhost:4200/api/zones/2/schedule/stop

curl localhost:4200/api/congestion-levels
```

## Wiring into the rest of the team's work

- **Supply**: feed `supplyKwh` from `solarlink-iot-meter`'s
  `SurplusService.getZoneSummaries()` — that's exactly the zone-aggregated
  available-surplus number this engine expects.
- **Demand**: feed `demandKwh` from the matching engine's pending buy-order
  total for the zone (not built yet — this engine takes it as a plain
  number so it doesn't need to know how demand was computed).
- **Congestion**: feed `congestionLevel` from a congestion engine watching
  the same zone-load numbers the meter simulator's `CONGESTION` scenario
  produces (also not built yet — same reasoning: this engine only consumes
  the level, it doesn't decide it).
- **Blockchain**: when a trade is created, store the `quote` object (or at
  least `zoneId` + `timestamp`) alongside the trade so the blockchain
  adapter's `createTrade()` call and this engine's audit log can be
  cross-referenced for a given trade — satisfies rule 5 end to end, not
  just within this module.
- **Matching engine**: check `quote.tradeAllowed` before creating/locking
  any trade in a zone — `CONSTRAINED` congestion should block new trades
  even though a price is still computed for display purposes.

## Design notes

- **Formula is injected, not hardcoded** (`formulas.js` + `PricingEngine`
  constructor args): `demandPressureFormula` and `marketPriceFormula` are
  plain functions with sane defaults matching the doc's model exactly, but
  either can be swapped per-instance — see the demo's "cubic formula"
  example.
- **Per-zone configuration**: `floor`, `ceiling`, `elasticityFactor`, and
  `repricingIntervalMs` are all set per zone via `configureZone()`, so
  different zones can have different bands and re-pricing cadences.
- **Congestion is a lookup, not a calculation**: `CongestionLevels.js`
  defines `NORMAL` / `ELEVATED` / `CONSTRAINED` with a surcharge and a
  `tradeAllowed` flag, and a zone can override the defaults if it has
  tighter physical limits than another zone.
- **Audit log is append-only and unbounded for the life of the process**
  (per rule 5, "store the inputs used for every trade quote"); if this runs
  for a long demo, consider periodically flushing `engine.auditLog` to a
  file or the backend's database rather than keeping it all in memory.
