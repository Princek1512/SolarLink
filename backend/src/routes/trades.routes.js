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
router.post('/:id/lock', verifyToken, requireRole(['admin', 'prosumer', 'consumer']), tradesController.lockTrade);
router.post('/:id/delivery/verify', verifyToken, requireRole(['admin', 'meter_verifier', 'prosumer', 'consumer']), tradesController.verifyDelivery);
router.post('/:id/progress', verifyToken, requireRole(['admin', 'prosumer', 'consumer']), tradesController.autoProgress);
router.post('/:id/dispute', verifyToken, requireRole(['admin']), tradesController.disputeTrade);
router.post('/:id/flag', verifyToken, requireRole(['admin', 'regulator']), tradesController.flagTrade);

module.exports = router;
