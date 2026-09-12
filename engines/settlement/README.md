# SolarLink — Settlement & Dispute Engine

Implements `SETTLEMENT_DISPUTE.md` in full, and wires it to
`solarlink-blockchain`'s `BlockchainAdapter` state machine (`LOCKED` ->
`DELIVERED` -> `VERIFIED`/`DISPUTED` -> `SETTLED`). Zero external
dependencies — built on Node's built-ins, so there's nothing to
`npm install`.

## What's here

```
src/
  engine/feeFormulas.js       # platform/grid fee + refund formulas — swappable, not hardcoded
  engine/DisputeCalculator.js # shortfall_percent + tolerance decision, adapter-independent
  engine/SettlementEngine.js  # gross/fees/refund/prosumer_credit/consumer_debit, audit log
  bridge/BlockchainBridge.js  # drives a BlockchainAdapter through delivery -> dispute -> settlement
  server.js                   # plain-Node REST API (pure calculation preview)
test/
  demo.js                     # proves SETTLEMENT_DISPUTE.md's state diagram end to end
```

## Run the demo

```bash
node test/demo.js
```

Walks through, in order:

1. **Path 1 — no shortfall**: `LOCKED` → `DELIVERED` → `VERIFIED` →
   `SETTLED`, full gross paid out minus fees, zero refund.
2. **Path 2 — the doc's own example**: `BLOCKCHAIN_DESIGN.md` §20's worked
   case (contracted=10, delivered=8, tolerance=10% → shortfall=20%) driven
   all the way to `DISPUTED` → partial refund → `SETTLED`.
3. **Identity check** — `prosumer_credit` always equals `consumer_debit`
   minus total fees, exactly, by construction.
4. **Severe shortfall** — near-total non-delivery still clamps the refund
   at `gross`, so credit/debit never go negative.
5. **Duplicate settlement** — a note on where the real
   `BlockchainAdapter.settleTrade()`'s `DUPLICATE_SETTLEMENT` rejection
   fits (the demo's `FakeBlockchainAdapter` is simplified and skips it).
6. **Audit log** — every `computeSettlement()` call kept for the same
   auditability reason as pricing rule 5.

## Run the REST server

```bash
node src/server.js   # listens on :4400
```

```bash
# Configure a zone's fee percentages (falls back to the engine's defaults
# for any zone not configured — see "_default" in SettlementEngine)
curl -X POST localhost:4400/api/fees -H "content-type: application/json" \
  -d '{"zoneId":2,"platformFeePercent":0.025,"gridFeePercent":0.01}'

# Compute a settlement preview — pure calculation, no side effects,
# no blockchain calls
curl -X POST localhost:4400/api/settlements -H "content-type: application/json" \
  -d '{"tradeId":"t1","zoneId":2,"quantityKwh":10,"agreedPrice":7,"deliveredKwh":8,"tolerancePercent":10}'

# Audit trail
curl localhost:4400/api/settlements/t1/audit
curl localhost:4400/api/settlements/audit
```

The server only exposes the pure `SettlementEngine` calculation — it does
not drive a real `BlockchainAdapter`. That's what `BlockchainBridge` is
for, used directly in code (see "Wiring" below), not over REST, since it
needs a live adapter instance, not just JSON in/out.

## Wiring into the rest of the team's work

- **Blockchain**: construct `BlockchainBridge({ adapter, settlementEngine })`
  with a real `BlockchainAdapter` instance, then call
  `bridge.finalizeDelivery(tradeId, { deliveredKwh, meterReadings })` once
  meter verification data is ready. It calls `recordDelivery` →
  (if disputed) `resolveDispute` → `settleTrade` in order, and returns
  `{ trade, settlement, walletUpdate }`. `disputeTolerancePercent`
  defaults to whatever the adapter itself was constructed with
  (`adapter.disputeTolerancePercent`), so the adapter's own
  `VERIFIED`/`DISPUTED` decision and this engine's `isDisputed` decision
  can never disagree — pass an explicit value only to intentionally
  diverge.
- **Wallets**: `walletUpdate` (`prosumerCredit`, `consumerDebit`,
  `platformFee`, `gridFee`, `refund`) is TRADING_FLOW.md's "Wallet
  Updates" step's exact numbers — this module computes them but does not
  apply them; Member 1's backend applies them via `API.md`'s
  `/wallet`/`/wallet/transactions` endpoints.
- **Pricing/matching**: `quantityKwh` and `agreedPrice` fed into
  `computeSettlement` should be the same `agreedPrice` that
  `MATCHING_PRICE.md` establishes as `quote.finalPricePerKwh` at match
  time (stored on the trade as `agreedPrice` by `BlockchainAdapter
  .createTrade`) — settlement never recomputes or second-guesses that
  price, it only applies fees and refund on top of it.
- **Congestion**: no direct dependency — congestion gates whether a trade
  is created at all (see `solarlink-congestion-engine`); settlement only
  runs on trades that already exist and have been delivered.

## Design notes

- **Fees are charged on the original gross, not the delivered amount** —
  a direct reading of `SETTLEMENT_DISPUTE.md`'s own formulas (`platform_fee`
  / `grid_fee` reference `gross` only, never `delivered`). Only the refund
  — and therefore `prosumer_credit`/`consumer_debit` — moves with delivery
  performance.
- **Refund formula is injectable, not hardcoded**, same convention as
  `solarlink-pricing-engine/formulas.js`. The default is proportional to
  shortfall (`gross × shortfallPercent / 100`, clamped to `[0, gross]`) —
  a design decision, since neither `SETTLEMENT_DISPUTE.md` nor
  `BLOCKCHAIN_DESIGN.md` §20 pins down the exact refund rule, just that a
  bigger shortfall should mean a bigger refund. Swap in a different policy
  (fixed penalty, tiered bands) via the constructor without touching
  `SettlementEngine` itself.
- **`prosumer_credit = consumer_debit - fees`, always** — an identity that
  falls directly out of the doc's formulas and is a good sanity check when
  wiring up real wallets (see the demo's "Identity Check" section).
  This says the split is symmetric: the consumer's debit and the
  prosumer's credit only ever differ by the fees taken out; the refund
  reduces both equally.
- **`DisputeCalculator` is adapter-independent on purpose** — it exists so
  the shortfall/tolerance formula is documented and testable standalone,
  even though `BlockchainAdapter.recordDelivery()` already computes an
  equivalent number internally. `BlockchainBridge` computes shortfall from
  the raw `deliveredKwh` it already has rather than reading
  `trade.dispute.shortfallPercent` off the adapter's response, because
  that field is `null` on the non-disputed path — reading it directly
  would misreport a real-but-under-tolerance shortfall as exactly 0.
- **Per-zone fee overrides** follow the same "zone can override defaults"
  pattern as `CongestionLevels.js` on the congestion side, even though
  `SETTLEMENT_DISPUTE.md` doesn't require it — useful if different zones
  end up with different platform/grid fee arrangements later.
- **Audit log is append-only and unbounded for the life of the process**,
  same tradeoff the pricing and congestion engines make and flag for the
  same reason — flush it to the backend's database for a long-running
  demo.
