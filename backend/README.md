# SolarLink Backend

This is the backend service for the SolarLink application. It is a Node.js/Express app backed by PostgreSQL, orchestrating the dynamic peer-to-peer renewable energy trading marketplace.

## Architecture

This backend serves as the single source of truth for the frontend applications (prosumer and consumer). It handles:
- Authentication & Role-based Access Control (JWT)
- Database persistence (PostgreSQL)
- REST API for frontend dashboards
- Engine Instantiation & Integration

The backend directly integrates with the monorepo's existing engines:
- **Blockchain Adapter (`:4000`)**: Records all trade lifecycle events (Matched, Locked, Delivered, Settled, Disputed) onto a tamper-evident hash chain.
- **IoT Meter Simulator (`:4100`)**: Simulates smart meter readings and generates surplus energy listings.
- **Pricing Engine (`:4200`)**: Dynamically computes energy prices based on supply, demand, and grid congestion.
- **Congestion Engine (`:4300`)**: Tracks grid load and determines congestion status (NORMAL, ELEVATED, CONSTRAINED).
- **Settlement Engine (`:4400`)**: Computes platform/grid fees, refunds, and final wallet updates.

*Note: In the MVP implementation, the backend instantiates these engines directly within the Node.js process using `require()` to share state easily. The ports mentioned above correspond to their standalone REST instances if run separately.*

## Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)

## Setup

1. **Install Dependencies**
   \`\`\`bash
   cd backend
   npm install
   \`\`\`

2. **Environment Variables**
   The backend reads configuration from `backend/.env`. Example:
   \`\`\`env
   PORT=3000
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/solarlink
   JWT_SECRET=supersecretjwtkey123
   \`\`\`

3. **Database Setup**
   Ensure PostgreSQL is running. You can create the database and run migrations/seeds using `psql`:
   \`\`\`bash
   # Create database (if needed)
   createdb solarlink -U postgres

   # Run Schema
   psql -d solarlink -U postgres -f ../database/schema.sql

   # Run Seed (optional demo data)
   psql -d solarlink -U postgres -f ../database/seed.sql
   \`\`\`

## Running the Server

Start the application in development mode (using nodemon):
\`\`\`bash
npm run dev
\`\`\`
Or in production mode:
\`\`\`bash
npm start
\`\`\`

The API will be available at `http://localhost:3000/api`.
