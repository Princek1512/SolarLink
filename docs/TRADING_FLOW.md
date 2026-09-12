# End-to-End Trading Flow

```text
Prosumer Login
     ↓
Register Solar Asset
     ↓
Connect Simulated Meter
     ↓
Generation > Consumption
     ↓
Surplus Detected
     ↓
Create/Update Listing
     ↓
Dynamic Price Quote
     ↓
Consumer Views Offer
     ↓
Consumer Places Buy Order
     ↓
Matching Engine
     ↓
Congestion Check
     ↓
Trade Locked
     ↓
Energy Delivery
     ↓
Meter Verification
     ↓
Verified?
 ┌───┴────┐
No       Yes
↓         ↓
Dispute  Settlement
           ↓
     Wallet Updates
           ↓
       Dashboard
```

## Trade States

- MATCHED
- LOCKED
- DELIVERED
- VERIFIED
- SETTLED
- DISPUTED
- CANCELLED

Every state transition must be recorded with timestamp and tamper-evident event information.
