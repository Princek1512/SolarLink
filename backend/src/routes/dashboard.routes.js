const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/market', dashboardController.getMarketDashboard);
router.get('/prosumer', verifyToken, requireRole(['prosumer', 'admin']), dashboardController.getProsumerDashboard);
router.get('/consumer', verifyToken, requireRole(['consumer', 'admin']), dashboardController.getConsumerDashboard);
router.get('/regulator', verifyToken, requireRole(['regulator', 'admin', 'utility']), dashboardController.getRegulatorDashboard);

module.exports = router;
