const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

// All admin routes require admin role
const adminOnly = [verifyToken, requireRole(['admin'])];

router.get('/dashboard', ...adminOnly, adminController.getAdminDashboard);
router.get('/requests', ...adminOnly, adminController.getRequests);
router.post('/requests/:id/approve', ...adminOnly, adminController.approveRequest);
router.post('/requests/:id/reject', ...adminOnly, adminController.rejectRequest);
router.get('/audit', ...adminOnly, adminController.getAuditLogs);
router.get('/trades', ...adminOnly, adminController.getAdminTrades);
router.get('/blockchain', ...adminOnly, adminController.getBlockchain);
router.get('/users', ...adminOnly, adminController.getUsers);

module.exports = router;
