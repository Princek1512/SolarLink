const express = require('express');
const router = express.Router();
const tradesController = require('../controllers/trades.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { matchTrades } = require('../services/matching.service');

router.post('/match', verifyToken, requireRole(['admin', 'trading_engine']), async (req, res, next) => {
  try {
    const matched = await matchTrades();
    res.json(matched);
  } catch (err) {
    next(err);
  }
});

router.get('/', verifyToken, tradesController.getTrades);
router.get('/:id', verifyToken, tradesController.getTrade);
router.get('/:id/events', verifyToken, tradesController.getTradeEvents);
router.post('/:id/delivery/verify', verifyToken, requireRole(['admin', 'meter_verifier']), tradesController.verifyDelivery);
router.post('/:id/dispute', verifyToken, requireRole(['admin']), tradesController.disputeTrade);

module.exports = router;
