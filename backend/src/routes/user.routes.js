const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// All routes require auth
router.use(protect);

// Profile
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);

// Bank Details
router.put('/bank-details', userController.updateBankDetails);

// Dashboard
router.get('/dashboard', userController.getDashboard);

// Referrals
router.get('/referrals', userController.getReferrals);

module.exports = router;
