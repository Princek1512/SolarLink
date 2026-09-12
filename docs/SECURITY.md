# Security Requirements

## Authentication

- Hash passwords.
- Use JWT/session authentication.
- Never expose password hashes.

## Authorization

Role permissions:

- Prosumer: own assets/listings/trades
- Consumer: own orders/trades
- Utility: grid monitoring/control
- Regulator: restricted read-only compliance
- Admin: configuration/administration

## Trade Integrity

- Do not trust price, quantity, fee, or status values supplied by the frontend.
- Recalculate/validate critical values on the backend.
- Record every state transition.

## Ledger Integrity

Hash-chain every trade event if using the simulated ledger.

## API Protection

- Validate input.
- Reject unauthorized role actions.
- Prevent duplicate settlement.
- Use database transactions for wallet updates.
