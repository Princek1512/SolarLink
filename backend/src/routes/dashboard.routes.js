const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/market', dashboardController.getMarketDashboard);
router.get('/prosumer', verifyToken, requireRole(['prosumer', 'admin']), dashboardController.getProsumerDashboard);
router.get('/consumer', verifyToken, requireRole(['consumer', 'admin']), dashboardController.getConsumerDashboard);
router.get('/regulator', verifyToken, requireRole(['regulator', 'admin']), dashboardController.getRegulatorDashboard);
router.get('/utility', verifyToken, requireRole(['utility', 'admin']), dashboardController.getUtilityDashboard);

module.exports = router;
