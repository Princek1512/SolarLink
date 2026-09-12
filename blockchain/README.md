# SolarLink — Blockchain / Tamper-Evident Ledger Layer

This implements the blockchain layer described in `BLOCKCHAIN_DESIGN.md` and
`BLOCKCHAIN_LEDGER.md`: Member 3's ownership area. It follows the hackathon
priority order from the design doc — Priority 2 (hash-chained ledger) is
fully built and tested; Priority 3 (Solidity) is included as a ready-to-wire
upgrade.

No external npm packages are required — everything runs on Node's built-ins
(`crypto`, `http`), so there's nothing to `npm install` before the demo.

## What's here

```
src/
  ledger/HashChainLedger.js     # append-only hash chain (SHA256, prev-hash linking)
  state/TradeStateMachine.js    # valid trade transitions, enforced everywhere
  adapter/BlockchainAdapter.js  # the ONE interface the rest of the app calls
  adapter/SolidityAdapter.js    # same interface, scaffold for a real testnet contract
  server.js                    # plain-Node REST server wrapping the adapter
contracts/
  SolarLinkTrade.sol           # Solidity version of the same lifecycle/roles
test/
  demo.js                      # end-to-end demo, incl. tamper-detection proof
```

## Run the demo

```bash
node test/demo.js
```

This walks two trades end to end (a clean settlement, and a shortfall that
triggers a dispute → partial refund → settlement), prints the audit trail
for each, then **deliberately tampers with an old ledger event** and shows
`verifyLedgerIntegrity()` catch it — that's the "tamper-evident" proof for
your demo.

## Run the REST server (for Member 1 / frontend integration)

```bash
node src/server.js
# listens on http://localhost:4000
```

```bash
curl -X POST localhost:4000/api/trades -H "content-type: application/json" \
  -d '{"tradeId":2001,"buyer":"alice","seller":"ravi","zoneId":2,"quantityKwh":4.2,"agreedPrice":6.8}'

curl -X POST localhost:4000/api/trades/2001/lock

curl -X POST localhost:4000/api/trades/2001/deliver -H "content-type: application/json" \
  -d '{"deliveredKwh":4.1,"meterReadings":[{"t":1,"kwh":4.1}]}'

curl -X POST localhost:4000/api/trades/2001/settle

curl localhost:4000/api/trades/2001/history   # full audit trail for the frontend timeline
curl localhost:4000/api/ledger/verify         # { valid: true } unless tampered
```

Full endpoint list: `POST /api/trades`, `GET /api/trades`, `GET /api/trades/:id`,
`POST /api/trades/:id/lock`, `POST /api/trades/:id/cancel`,
`POST /api/trades/:id/deliver`, `POST /api/trades/:id/dispute/resolve`,
`POST /api/trades/:id/settle`, `GET /api/trades/:id/history`,
`GET /api/ledger`, `GET /api/ledger/verify`.

If Member 1's backend is Node/Express (per `PROJECT_PLAN.md`), it's simpler
to skip the HTTP hop entirely and `require('./adapter/BlockchainAdapter')`
directly inside the Express trade routes — call `chain.createTrade(...)`
etc. right after the matching engine (Member 2) returns a match.

## How it maps to the design doc

- **Lifecycle** (`TradeStateMachine.js`): `MATCHED → LOCKED → DELIVERED →
  VERIFIED → SETTLED`, with `DELIVERED → DISPUTED → SETTLED` as the
  alternate path, exactly as specified in §6. Invalid transitions throw
  immediately (`INVALID_TRANSITION`), duplicate trades and duplicate
  settlements are rejected (`DUPLICATE_TRADE`, `DUPLICATE_SETTLEMENT`).
- **Roles** (§10): `ADMIN`, `TRADING_ENGINE`, `SETTLEMENT_ENGINE`,
  `METER_VERIFIER`, `REGULATOR` — each adapter method checks the caller's
  role and rejects unauthorized calls (`UNAUTHORIZED`), matching both the
  Node adapter and the Solidity contract's modifiers.
- **What's on-chain vs off-chain** (§3/§21): raw meter readings never touch
  the ledger — `recordDelivery()` hashes them (`meterDataHash`) and only the
  hash + delivered total go on the chain, keeping it small.
- **Tamper evidence** (§14): `HashChainLedger.verifyChain()` recomputes every
  hash and every prev-hash link; `test/demo.js` shows it flip from `valid:
  true` to `valid: false` (with the exact broken index) after a single field
  is edited on an old event.
- **Adapter pattern** (§5/§16): `BlockchainAdapter` is what the rest of the
  app calls. `SolidityAdapter.js` exposes the identical method signatures so
  swapping in a real testnet contract later doesn't touch any calling code —
  it's Priority 3, only worth doing once Priority 1+2 are demo-stable.
- **Solidity contract** (§7-10): `contracts/SolarLinkTrade.sol` mirrors the
  Trade struct, TradeStatus enum, role modifiers, and events from the design
  doc, plus the same auto-dispute logic on `verifyDelivery()`. It compiles
  as vanilla Solidity ^0.8.20 (no OpenZeppelin dependency), so it'll build
  with Hardhat/Foundry without extra installs.

## Suggested demo script (fits the 5-minute rehearsal)

1. Create + lock a trade (or trigger it from the real matching engine).
2. Feed in a normal delivery → show it auto-verify and settle, then show the
   audit trail timeline in the frontend.
3. Feed in a short delivery on a second trade → show it auto-dispute, apply
   a partial refund, then settle.
4. Run `node test/demo.js`'s tamper step live (or point at the ledger JSON)
   to show `verifyLedgerIntegrity()` flip to `false` — this is the "why
   blockchain" payoff moment for judges.
