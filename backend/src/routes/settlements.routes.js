const express = require('express');
const router = express.Router();
const settlementsController = require('../controllers/settlements.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.post('/:tradeId', verifyToken, requireRole(['admin']), settlementsController.settleTrade);

module.exports = router;
