const express = require('express');
const router = express.Router();
const roiController = require('../controllers/roiController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ==================== ADMIN ROUTES ====================
// Manual ROI distribution trigger (Admin only)
router.post(
  '/trigger',
  protect,
  restrictTo('admin', 'superadmin'),
  roiController.triggerROIDistribution
);

// ==================== USER ROUTES ====================
// Get user's ROI history
router.get(
  '/history',
  protect,
  roiController.getROIHistory
);

// Get ROI summary/dashboard
router.get(
  '/summary',
  protect,
  roiController.getROISummary
);

module.exports = router;
