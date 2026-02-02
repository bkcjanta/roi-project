const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// All routes require authentication
router.use(protect);

// Get user's all transactions
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, status, walletType, page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = { userId };
    
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (walletType) filter.walletType = walletType;

    // Pagination
    const skip = (page - 1) * limit;

    // Get transactions
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    // Get total count
    const total = await Transaction.countDocuments(filter);

    res.json({
      status: 'success',
      data: {
        transactions,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Get transactions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transactions',
      error: error.message,
    });
  }
});

// Get single transaction
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found',
      });
    }

    res.json({
      status: 'success',
      data: { transaction },
    });
  } catch (error) {
    logger.error('Get transaction error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transaction',
      error: error.message,
    });
  }
});

// Get transaction stats
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await Transaction.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } },
        },
      },
    ]);

    // Calculate totals
    const summary = {
      totalTransactions: 0,
      totalDebit: 0,
      totalCredit: 0,
      byType: {},
    };

    stats.forEach(item => {
      summary.totalTransactions += item.count;
      summary.byType[item._id] = {
        count: item.count,
        amount: item.totalAmount,
      };

      // Categorize debit/credit
      const debitTypes = ['investment_debit', 'withdraw_approved', 'transfer_out', 'admin_debit', 'penalty'];
      const creditTypes = ['roi_credit_daily', 'referral_income', 'level_income', 'deposit_manual', 'admin_credit', 'bonus'];

      if (debitTypes.includes(item._id)) {
        summary.totalDebit += item.totalAmount;
      } else if (creditTypes.includes(item._id)) {
        summary.totalCredit += item.totalAmount;
      }
    });

    res.json({
      status: 'success',
      data: { stats: summary },
    });
  } catch (error) {
    logger.error('Get transaction stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch stats',
      error: error.message,
    });
  }
});

module.exports = router;
