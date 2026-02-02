const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const roiController = require('../controllers/roiController');

// ==================== USER ROUTES ====================

// Get own ROI history
router.get('/history', protect, roiController.getROIHistory);

// ==================== ADMIN ROUTES ====================

// Manual ROI distribution (admin only)
router.post('/distribute', protect, adminOnly, roiController.triggerROIDistribution);

module.exports = router;
