const express = require('express');
const router = express.Router();
const disputesController = require('../controllers/disputes.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/', verifyToken, requireRole(['admin', 'regulator', 'utility']), disputesController.getDisputes);
router.post('/:id/resolve', verifyToken, requireRole(['admin', 'regulator', 'utility']), disputesController.resolveDispute);

module.exports = router;
