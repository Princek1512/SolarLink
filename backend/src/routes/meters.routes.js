const express = require('express');
const router = express.Router();
const metersController = require('../controllers/meters.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/:id/latest', verifyToken, metersController.getLatestReading);
router.get('/:id/readings', verifyToken, metersController.getReadings);
router.post('/:id/simulate', verifyToken, requireRole(['prosumer', 'admin']), metersController.simulateReading);

module.exports = router;
