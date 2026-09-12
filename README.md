# ☀️ SolarLink — Peer-to-Peer Solar Energy Trading Platform

SolarLink is a decentralized, microgrid-capable Peer-to-Peer (P2P) Solar Energy Trading Platform. It connects **Prosumers** (solar energy generators with excess capacity) directly with **Consumers** (energy buyers within grid zones) through automated IoT meter tracking, real-time dynamic pricing, microgrid congestion management, smart contract trade settlements, and an append-only immutable audit ledger.

---

## 🚀 Key Features

### 👥 Multi-Role Ecosystem & Strict Access Control (RBAC)
- **Prosumers**: Monitor generation & consumption surplus, view balance, configure sell preferences (available surplus & minimum rate), and track completed/settled trades.
- **Consumers**: Browse real-time zone listings, purchase energy quantities, monitor wallet balances, and track delivery progress.
- **Admin**: Full platform control — registration approval queue (`user_requests`), transaction KPIs, system-wide trade monitoring, fee management, and immutable audit logs.
- **Regulator & Utility**: Read-only oversight of zone congestion, grid health, load capacity, and blockchain ledger integrity.

### ⚡ Autonomous Microgrid Engines
1. **IoT Meter Engine**: Simulates real-time solar generation and home consumption. Automatically calculates eligible net surplus energy.
2. **Dynamic Pricing Engine**: Computes real-time dynamic rates based on zone demand/supply elasticity, grid congestion multipliers, and floor/ceiling limits.
3. **Matching Engine**: Automatically pairs eligible prosumer surplus offers with consumer purchase orders within localized grid zones.
4. **Congestion Engine**: Tracks real-time grid zone capacity (`current_load_kw` / `capacity_kw`), auto-applying congestion multipliers to prevent localized transformer overloads.
5. **Settlement & Dispute Engine**: Verifies meter delivery against contracted amounts. Auto-calculates platform/grid fees, handles shortfalls, issues buyer refunds, and credits prosumer wallets.
6. **Blockchain Ledger**: Maintains an immutable HashChain ledger of every trade lifecycle event (`TradeCreated`, `TradeLocked`, `DeliveryRecorded`, `TradeVerified`, `DisputeRaised`, `TradeSettled`), verifyable against cryptographic hashes.

---

## 🛠️ Architecture & Tech Stack

```text
       ┌────────────────────────────────────────────────────────┐
       │                 React 18 + Vite Frontend              │
       │     (Dashboard, Marketplace, Requests, Trades, Audit)  │
       └──────────────────────────┬─────────────────────────────┘
                                  │ REST API / JWT
       ┌──────────────────────────▼─────────────────────────────┐
       │                Node.js / Express Backend               │
       └────┬──────────┬──────────┬──────────┬──────────┬───────┘
            │          │          │          │          │
   ┌────────▼───┐ ┌────▼─────┐ ┌──▼───────┐ ┌▼────────┐ ┌▼──────────┐
   │ IoT Meter  │ │ Pricing  │ │ Matching │ │Congestion│ │Settlement │
   │ Engine     │ │ Engine   │ │ Engine   │ │ Engine   │ │ Engine    │
   └────────────┘ └──────────┘ └──────────┘ └─────────┘ └───────────┘
            │          │          │          │          │
       ┌────┴──────────┴──────────┴──────────┴──────────┴───────┐
       │        PostgreSQL Database & HashChain Ledger          │
       └────────────────────────────────────────────────────────┘
```

- **Frontend**: React 18, Vite, Lucide Icons, Custom CSS Design Token System
- **Backend**: Node.js, Express.js, PostgreSQL (`pg`), JWT Auth, Bcrypt
- **Engines**: Custom Node.js microgrid simulation and settlement engines
- **Blockchain**: `HashChainLedger` cryptographic event chain with Solidity smart contract compatibility (`SolarLinkTrade.sol`)

---

## 📦 Directory Structure

```text
SolarLink/
├── backend/                # Express API server & Controllers
│   ├── src/
│   │   ├── controllers/    # Admin, Auth, Marketplace, Trades, Wallet, etc.
│   │   ├── middleware/     # JWT & Role-based Access Control (RBAC)
│   │   ├── routes/         # Endpoint definitions
│   │   └── services/       # Audit service, DB connection, Engine bridges
├── frontend/               # React Vite UI
│   ├── src/
│   │   ├── components/     # Navbar, Cards, Badges, Timelines
│   │   ├── pages/          # AdminDashboard, AdminRequests, AdminAudit, Marketplace, etc.
│   │   └── services/       # Axios/Fetch API client
├── database/               # Database SQL Scripts
│   ├── schema.sql          # PostgreSQL DDL (Tables, Indexes, Constraints)
│   └── seed.sql            # Initial Seed Data (Admin, Zones, Seed Users)
├── engines/                # Microgrid Trading Subsystem Engines
│   ├── congestion/         # Zone capacity & load tracker
│   ├── iot-meter/          # Meter simulator & surplus service
│   ├── matching/           # Automated order matching
│   ├── pricing/            # Dynamic pricing formulas & scheduler
│   └── settlement/         # Delivery verification & fee calculator
├── blockchain/             # HashChain Ledger & Solidity Contracts
│   ├── contracts/          # SolarLinkTrade.sol
│   └── src/                # HashChainLedger & BlockchainAdapter
├── docs/                   # System Documentation & Architecture Specs
└── docker-compose.yml      # Multi-container deployment configuration
```

---

## 🚦 Quick Start Guide

### Prerequisites
- **Node.js**: v18.x or higher
- **PostgreSQL**: v14.x or higher
- **npm** or **yarn**

### 1. Database Setup
Create a PostgreSQL database named `solarlink` and run the schema and seed scripts:

```bash
psql -U postgres -d postgres -c "CREATE DATABASE solarlink;"
psql -U postgres -d solarlink -f database/schema.sql
psql -U postgres -d solarlink -f database/seed.sql
```

### 2. Backend Configuration & Launch
Create a `.env` file inside `backend/`:

```env
PORT=3000
DATABASE_URL=postgres://postgres:password123@localhost:5432/solarlink
JWT_SECRET=supersecretjwtkey123
```

Start the backend API server:

```bash
cd backend
npm install
npm run dev
```
*Backend will run on `http://localhost:3000`*

### 3. Frontend Launch
Start the React Vite development server:

```bash
cd frontend
npm install
npm run dev
```
*Frontend will run on `http://localhost:5173`*

---

## 🔑 Default Accounts (Seed Data)

| Role | Email | Password | Access / Capabilities |
|------|-------|----------|-----------------------|
| **Admin** | `admin@solarlink.com` | `password123` | Full access to Admin Dashboard, User Requests queue, Trades monitoring, Audit Log, and Blockchain Ledger |
| **Prosumer** | `alice@example.com` | `password123` | Offer surplus energy, set asking price, view active/settled trades & wallet balance |
| **Consumer** | `bob@example.com` | `password123` | Browse marketplace, purchase energy, track delivery & wallet balance |

---

## 📡 Core API Endpoints

### 🔐 Auth & Admin
- `POST /api/auth/register` — Register new consumer/prosumer (creates pending user request)
- `POST /api/auth/login` — Authenticate and receive JWT token
- `GET /api/admin/dashboard` — Platform KPIs & aggregated chart metrics
- `GET /api/admin/requests` — User registration approval queue
- `POST /api/admin/requests/:id/approve` — Approve user request & activate user
- `GET /api/admin/audit` — Paginated append-only audit trail with search & trade ID filters

### ⚡ Marketplace & Trades
- `GET /api/marketplace/listings` — List active available energy offers by zone
- `POST /api/marketplace/purchase` — Execute consumer energy purchase
- `GET /api/trades` — Get trades for user or admin
- `GET /api/trades/:id/events` — Retrieve trade lifecycle events & cryptographic hashes

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.