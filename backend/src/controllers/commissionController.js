const mongoose = require('mongoose');
const Commission = require('../models/Commission');
const BinaryTransaction = require('../models/BinaryTransaction');
const levelIncomeService = require('../services/levelIncomeService');
const binaryIncomeService = require('../services/binaryIncomeService');
const logger = require('../utils/logger');

// ==================== GET MY LEVEL INCOME ====================
exports.getMyLevelIncome = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const data = await levelIncomeService.getUserLevelIncome(userId, {
      page,
      limit,
      status,
    });

    res.status(200).json({
      status: 'success',
      data,
    });
  } catch (error) {
    logger.error('Get level income error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch level income',
      error: error.message,
    });
  }
};

// ==================== GET LEVEL INCOME SUMMARY ====================
exports.getLevelIncomeSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const summary = await levelIncomeService.getLevelIncomeSummary(userId);

    res.status(200).json({
      status: 'success',
      data: summary,
    });
  } catch (error) {
    logger.error('Get level income summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch level income summary',
      error: error.message,
    });
  }
};

// ==================== GET MY BINARY INCOME ====================
exports.getMyBinaryIncome = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const data = await binaryIncomeService.getUserBinaryHistory(userId, {
      page,
      limit,
      status,
    });

    res.status(200).json({
      status: 'success',
      data,
    });
  } catch (error) {
    logger.error('Get binary income error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch binary income',
      error: error.message,
    });
  }
};

// ==================== GET BINARY INCOME SUMMARY ====================
exports.getBinaryIncomeSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const summary = await binaryIncomeService.getBinarySummary(userId);

    res.status(200).json({
      status: 'success',
      data: summary,
    });
  } catch (error) {
    logger.error('Get binary income summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch binary income summary',
      error: error.message,
    });
  }
};

// ==================== GET ALL COMMISSIONS ====================
exports.getAllCommissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type, status } = req.query;

    const filter = { userId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const commissions = await Commission.find(filter)
      .populate('fromUserId', 'userCode fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Commission.countDocuments(filter);

    // Get stats by type
    const stats = await Commission.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$type',
          total: { $sum: { $toDouble: '$amount' } },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        commissions,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
        stats,
      },
    });
  } catch (error) {
    logger.error('Get all commissions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch commissions',
      error: error.message,
    });
  }
};

// ==================== GET COMMISSION DETAILS ====================
exports.getCommissionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const commission = await Commission.findOne({
      _id: id,
      userId: userId,
    })
      .populate('fromUserId', 'userCode fullName email')
      .populate('transactionId');

    if (!commission) {
      return res.status(404).json({
        status: 'error',
        message: 'Commission not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { commission },
    });
  } catch (error) {
    logger.error('Get commission details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch commission details',
      error: error.message,
    });
  }
};

// ==================== TRIGGER BINARY CALCULATION (ADMIN) ====================
exports.triggerBinaryCalculation = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin only.',
      });
    }

    logger.info(`Binary calculation triggered by admin: ${req.user.id}`);

    const result = await binaryIncomeService.manualTrigger();

    res.status(200).json({
      status: 'success',
      message: 'Binary calculation completed',
      data: result,
    });
  } catch (error) {
    logger.error('Trigger binary calculation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to trigger binary calculation',
      error: error.message,
    });
  }
};

// ==================== PROCESS PENDING COMMISSIONS (ADMIN) ====================
exports.processPendingCommissions = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin only.',
      });
    }

    logger.info(`Commission processing triggered by admin: ${req.user.id}`);

    const result = await levelIncomeService.processPendingCommissions();

    res.status(200).json({
      status: 'success',
      message: 'Commissions processed',
      data: result,
    });
  } catch (error) {
    logger.error('Process commissions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process commissions',
      error: error.message,
    });
  }
};
