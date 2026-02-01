const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

// All routes require auth
router.use(protect);

// Get wallet summary
router.get('/', walletController.getWallet);

// Get transactions list
router.get('/transactions', walletController.getTransactions);

// Get single transaction
router.get('/transactions/:id', walletController.getTransactionById);

module.exports = router;
