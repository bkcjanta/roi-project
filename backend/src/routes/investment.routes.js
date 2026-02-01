const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investmentController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// User routes
router.post('/', investmentController.createInvestment);
router.get('/my-investments', investmentController.getMyInvestments);
router.get('/active', investmentController.getActiveInvestments);
router.get('/:id', investmentController.getInvestmentById);
router.get('/:investmentId/roi-history', investmentController.getROIHistory);

module.exports = router;
