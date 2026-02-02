const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// ==================== USER ROUTES ====================

// Request new withdrawal
router.post('/request', withdrawalController.requestWithdrawal);

// Get user's withdrawals
router.get('/my-withdrawals', withdrawalController.getMyWithdrawals);

// ==================== ADMIN ROUTES ====================

// Get all withdrawals (Admin only)
router.get('/admin/all', authorize('admin', 'super_admin'), withdrawalController.getAllWithdrawals);

// Approve withdrawal (Admin only)
router.put('/admin/:id/approve', authorize('admin', 'super_admin'), withdrawalController.approveWithdrawal);

// Reject withdrawal (Admin only)
router.put('/admin/:id/reject', authorize('admin', 'super_admin'), withdrawalController.rejectWithdrawal);

// Complete withdrawal - mark as paid (Admin only)
router.put('/admin/:id/complete', authorize('admin', 'super_admin'), withdrawalController.completeWithdrawal);

// ==================== DYNAMIC ROUTES (MUST BE LAST) ====================

// Get single withdrawal by ID
router.get('/:id', withdrawalController.getWithdrawalById);

// Cancel withdrawal (User)
router.put('/:id/cancel', withdrawalController.cancelWithdrawal);

module.exports = router;
