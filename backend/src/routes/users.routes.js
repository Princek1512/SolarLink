const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/:id', verifyToken, usersController.getUser);

module.exports = router;
