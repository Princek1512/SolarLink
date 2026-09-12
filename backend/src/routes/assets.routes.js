const express = require('express');
const router = express.Router();
const assetsController = require('../controllers/assets.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.post('/', verifyToken, requireRole(['prosumer', 'admin']), assetsController.createAsset);
router.get('/:id', verifyToken, assetsController.getAsset);
router.post('/:id/meter', verifyToken, requireRole(['prosumer', 'admin']), assetsController.createMeter);

module.exports = router;
