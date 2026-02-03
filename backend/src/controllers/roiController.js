const roiService = require('../services/roiService');
const logger = require('../utils/logger');

// Manual trigger ROI distribution (Admin only)
exports.triggerROIDistribution = async (req, res) => {
  try {
    logger.info(`Manual ROI distribution triggered by admin: ${req.user.email}`);
    
    const result = await roiService.manualDistribute();
    
    res.json({
      status: 'success',
      message: 'ROI distribution completed',
      data: result,
    });
  } catch (error) {
    logger.error('Manual ROI distribution error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to distribute ROI',
      error: error.message,
    });
  }
};

// Get ROI distribution history
exports.getROIHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const Transaction = require('../models/Transaction');

    // Fetch ROI transactions
    const transactions = await Transaction.find({ 
      userId,
      type: 'roi_credit_daily',
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('transactionId amount balanceBefore balanceAfter metadata createdAt');

    const total = await Transaction.countDocuments({ 
      userId,
      type: 'roi_credit_daily',
      status: 'completed'
    });

    res.json({
      status: 'success',
      data: {
        transactions,
        totalEarnings: transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Get ROI history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch ROI history',
      error: error.message,
    });
  }
};

// Get ROI summary
exports.getROISummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const Investment = require('../models/Investment');
    const Wallet = require('../models/Wallet');

    const investments = await Investment.find({ 
      userId,
      status: 'active'
    });

    const wallet = await Wallet.findOne({ userId });

    const summary = {
      totalInvestments: investments.length,
      totalInvestedAmount: investments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0),
      totalROIPaid: investments.reduce((sum, inv) => sum + parseFloat(inv.totalRoiPaid || 0), 0),
      currentROIBalance: parseFloat(wallet?.roiBalance || 0),
      dailyROIExpected: investments.reduce((sum, inv) => sum + parseFloat(inv.dailyRoiAmount || 0), 0),
      activeInvestments: investments.map(inv => ({
        id: inv._id,
        amount: parseFloat(inv.amount),
        dailyRoi: parseFloat(inv.dailyRoiAmount),
        totalPaid: parseFloat(inv.totalRoiPaid || 0),
        daysCompleted: inv.daysCompleted,
        duration: inv.duration,
        nextRoiDate: inv.nextRoiDate,
      })),
    };

    res.json({
      status: 'success',
      data: summary,
    });
  } catch (error) {
    logger.error('Get ROI summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch ROI summary',
      error: error.message,
    });
  }
};
