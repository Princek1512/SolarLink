const express = require('express');
const router = express.Router();
const zonesController = require('../controllers/zones.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/', zonesController.getZones);
router.get('/:id/status', zonesController.getZoneStatus);
router.patch('/:id', verifyToken, requireRole(['admin', 'utility']), zonesController.updateZone);

module.exports = router;
