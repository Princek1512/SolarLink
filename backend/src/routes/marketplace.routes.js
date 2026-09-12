const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplace.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/listings', marketplaceController.getListings);
router.post('/listings', verifyToken, requireRole(['prosumer', 'admin']), marketplaceController.createListing);
router.patch('/listings/:id', verifyToken, requireRole(['prosumer', 'admin']), marketplaceController.updateListing);
router.delete('/listings/:id', verifyToken, requireRole(['prosumer', 'admin']), marketplaceController.cancelListing);
router.post('/listings/:id/purchase', verifyToken, requireRole(['consumer', 'admin']), marketplaceController.purchaseListing);

router.get('/orders', verifyToken, marketplaceController.getOrders);
router.post('/orders', verifyToken, requireRole(['consumer', 'admin']), marketplaceController.createOrder);

module.exports = router;
