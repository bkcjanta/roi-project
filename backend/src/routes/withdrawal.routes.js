const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// ==================== USER ROUTES ====================

// Request new withdrawal
router.post('/request', withdrawalController.requestWithdrawal);

// Get user's withdrawals
router.get('/my-withdrawals', withdrawalController.getMyWithdrawals);

// Cancel withdrawal (User) - MUST be before /:id
router.put('/:id/cancel', withdrawalController.cancelWithdrawal);

// Get single withdrawal by ID - MUST be last
router.get('/:id', withdrawalController.getWithdrawalById);

// ==================== ADMIN ROUTES ====================

// Get withdrawal statistics (Admin only) ⭐ NEW
router.get('/admin/stats', restrictTo('admin', 'superadmin'), withdrawalController.getWithdrawalStats);

// Get all withdrawals (Admin only)
router.get('/admin/all', restrictTo('admin', 'superadmin'), withdrawalController.getAllWithdrawals);

// Approve withdrawal (Admin only)
router.put('/admin/:id/approve', restrictTo('admin', 'superadmin'), withdrawalController.approveWithdrawal);

// Reject withdrawal (Admin only)
router.put('/admin/:id/reject', restrictTo('admin', 'superadmin'), withdrawalController.rejectWithdrawal);

// Complete withdrawal - mark as paid (Admin only)
router.put('/admin/:id/complete', restrictTo('admin', 'superadmin'), withdrawalController.completeWithdrawal);

module.exports = router;
