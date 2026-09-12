require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const assetsRoutes = require('./routes/assets.routes');
const metersRoutes = require('./routes/meters.routes');
const marketplaceRoutes = require('./routes/marketplace.routes');
const tradesRoutes = require('./routes/trades.routes');
const pricingRoutes = require('./routes/pricing.routes');
const zonesRoutes = require('./routes/zones.routes');
const settlementsRoutes = require('./routes/settlements.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const walletRoutes = require('./routes/wallet.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/meters', metersRoutes);
app.use('/api/disputes', require('./routes/disputes.routes'));
app.use('/api', marketplaceRoutes); // /listings and /orders
app.use('/api/trades', tradesRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/zones', zonesRoutes);
app.use('/api/settlements', settlementsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SolarLink Backend running on port ${PORT}`);
  require('./services/automation.service').start();
});
