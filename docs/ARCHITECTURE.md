# System Architecture

```text
                    ┌──────────────────────┐
                    │      React Web App    │
                    │ Marketplace/Dashboards│
                    └──────────┬───────────┘
                               │ REST/WebSocket
                               ▼
                    ┌──────────────────────┐
                    │   Node/Express API   │
                    │ Auth + Business APIs │
                    └──────┬───────┬───────┘
                           │       │
              ┌────────────┘       └──────────────┐
              ▼                                   ▼
     ┌─────────────────┐                 ┌──────────────────┐
     │ PostgreSQL DB   │                 │ Trading Services │
     │ users/assets/   │                 │ Pricing/Matching │
     │ orders/trades   │                 │ Congestion       │
     └─────────────────┘                 └────────┬─────────┘
                                                  │
                           ┌──────────────────────┼─────────────────┐
                           ▼                      ▼                 ▼
                  ┌────────────────┐    ┌────────────────┐  ┌─────────────┐
                  │ Meter Simulator│    │ Ledger/Contract│  │ Settlement  │
                  └────────────────┘    └────────────────┘  └─────────────┘
```

## Module Ownership

| Module | Owner |
|---|---|
| Auth/API/DB | Member 1 |
| Meter + pricing + matching + congestion | Member 2 |
| UI + ledger/contract integration | Member 3 |

## Data Flow

1. Meter simulator generates readings.
2. Backend stores readings.
3. Surplus service calculates available energy.
4. Listing is created/updated.
5. Pricing engine calculates quote.
6. Consumer creates buy order.
7. Matching engine selects supply.
8. Ledger records the trade.
9. Delivery verification consumes meter readings.
10. Settlement updates wallets.
11. Dashboard receives updated state.

## Integration Contract

Member 2 should expose engine functions/services through backend APIs owned by Member 1.

Member 3 consumes stable API responses and should not duplicate pricing/matching logic in React.
