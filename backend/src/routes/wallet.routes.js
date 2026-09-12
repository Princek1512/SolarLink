const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/', verifyToken, walletController.getWallet);
router.get('/transactions', verifyToken, walletController.getTransactions);

// Deposits
router.post('/deposit', verifyToken, walletController.requestDeposit);
router.get('/deposits', verifyToken, requireRole(['admin']), walletController.getDeposits);
router.post('/deposits/:id/approve', verifyToken, requireRole(['admin']), walletController.approveDeposit);

module.exports = router;
