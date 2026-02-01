const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public Routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Protected Routes
router.get('/me', protect, authController.getCurrentUser);
router.post('/logout', protect, authController.logout);
router.post('/change-password', protect, authController.changePassword);

module.exports = router;
