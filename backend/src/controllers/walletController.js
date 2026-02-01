const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const logger = require('../utils/logger');

// ==================== GET WALLET ====================

exports.getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });

    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { wallet },
    });
  } catch (error) {
    logger.error('Get wallet error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch wallet',
      error: error.message,
    });
  }
};

// ==================== GET TRANSACTIONS ====================

exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;

    const filter = { userId: req.user.id };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Transaction.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        transactions,
        pagination: {
          total: count,
          page: Number(page),
          pages: Math.ceil(count / limit),
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
};

// ==================== GET TRANSACTION BY ID ====================

exports.getTransactionById = async (req, res) => {
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

    res.status(200).json({
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
};
