const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricing.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/quote', pricingController.getQuote);
router.get('/config/:zoneId', verifyToken, pricingController.getConfig);
router.patch('/config/:zoneId', verifyToken, requireRole(['admin', 'regulator']), pricingController.updateConfig);

module.exports = router;
