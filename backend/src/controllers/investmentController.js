const mongoose = require('mongoose');
const Investment = require('../models/Investment');
const Package = require('../models/Package');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const logger = require('../utils/logger');


// Create new investment
// Create new investment (WITHOUT transactions for standalone MongoDB)
// Create new investment (WITHOUT transactions for standalone MongoDB)
// Create new investment (WITHOUT transactions for standalone MongoDB)
// Create new investment with PROPER error handling
// Create new investment - PRODUCTION READY
exports.createInvestment = async (req, res) => {
  try {
    const { packageId, amount } = req.body;
    const userId = req.user.id;

    // Validation
    if (!packageId || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide package and amount',
      });
    }

    // Get package
    const package = await Package.findById(packageId);
    if (!package || !package.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Package not found or inactive',
      });
    }

    // Validate amount
    const minAmt = parseFloat(package.minAmount);
    const maxAmt = package.maxAmount ? parseFloat(package.maxAmount) : null;
    
    if (amount < minAmt || (maxAmt && amount > maxAmt)) {
      return res.status(400).json({
        status: 'error',
        message: `Amount must be between ${minAmt} and ${maxAmt || 'unlimited'}`,
      });
    }

    // Get user and wallet
    const user = await User.findById(userId);
    const wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found',
      });
    }

    // Check balance
    if (wallet.mainBalance < amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Insufficient balance',
      });
    }

    // Calculate dates and amounts
    const startDate = new Date();
    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + package.duration);
    
    const nextRoiDate = new Date();
    nextRoiDate.setDate(nextRoiDate.getDate() + 1);

    const dailyRoiAmount = (amount * package.roiRate) / 100;
    const totalRoiCap = (amount * package.roiCap) / 100;

    // Generate unique transaction ID
    const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Save original balance for rollback
    const originalBalance = wallet.mainBalance;
    const originalInvested = wallet.totalInvested;

    let transaction = null;
    let investment = null;

    try {
      // ✅ STEP 1: Create transaction record FIRST (pending state)
      // ✅ STEP 1: Create transaction record FIRST (pending state)
  transaction = await Transaction.create({
    userId,
    userCode: user.userCode,
    transactionId, // Optional: will auto-generate if not provided
    type: 'investment_debit',  // ✅ Changed to match enum
    amount,
    fee: 0,
    netAmount: amount,
    walletType: 'main',
    balanceBefore: originalBalance,
    balanceAfter: originalBalance - amount,
    status: 'pending',
    metadata: {
      packageId,
      packageName: package.name,
    },
  });

      // ✅ STEP 2: Create investment with transaction reference
      investment = await Investment.create({
        userId,
        packageId,
        packageName: package.name,
        amount,
        type: package.type,
        roiRate: package.roiRate,
        roiCap: package.roiCap,
        duration: package.duration,
        dailyRoiAmount,
        totalRoiCap,
        startDate,
        maturityDate,
        nextRoiDate,
        transactionId: transaction._id,
        status: 'active',
      });

      // ✅ STEP 3: Deduct from wallet (only after investment validated)
      wallet.mainBalance -= amount;
      wallet.totalInvested += amount;
      await wallet.save();

      // ✅ STEP 4: Mark transaction as completed
      transaction.status = 'completed';
      transaction.metadata.investmentId = investment._id;
      await transaction.save();

      logger.info(`✅ Investment created: User ${userId}, Amount ${amount}, ID ${investment._id}`);

      res.status(201).json({
        status: 'success',
        message: 'Investment created successfully',
        data: {
          investment,
          transaction: {
            transactionId: transaction.transactionId,
            status: transaction.status,
          },
          wallet: {
            mainBalance: wallet.mainBalance,
            totalInvested: wallet.totalInvested,
          },
        },
      });

    } catch (innerError) {
     logger.error('❌ Investment creation failed, rolling back:', innerError.message);
  
  // Restore wallet
  wallet.mainBalance = originalBalance;
  wallet.totalInvested = originalInvested;
  await wallet.save();

  // Mark transaction as failed (if created)
  if (transaction) {
    transaction.status = 'failed';
    transaction.metadata.error = innerError.message;
    await transaction.save();
  }

  // Delete investment if created but failed later
  if (investment) {
    await Investment.deleteOne({ _id: investment._id });
  }

  throw innerError;
    }

  } catch (error) {
    logger.error('Create investment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create investment',
      error: error.message,
    });
  }
};





// Get user's investments
// Get user's investments
exports.getMyInvestments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = { userId }; // ✅ Direct use, no ObjectId() needed
    
    if (status) {
      filter.status = status;
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Get investments
    const investments = await Investment.find(filter)
      .populate('packageId', 'name type roiRate duration')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Investment.countDocuments(filter);

    // Calculate stats
    const stats = await Investment.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId) // ✅ Use mongoose.Types.ObjectId
        } 
      },
      {
        $group: {
          _id: null,
          totalInvested: { $sum: '$amount' },
          totalRoiEarned: { $sum: '$totalRoiPaid' },
          activeInvestments: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
          completedInvestments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
        },
      },
    ]);

    res.json({
      status: 'success',
      data: {
        investments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
        stats: stats[0] || {
          totalInvested: 0,
          totalRoiEarned: 0,
          activeInvestments: 0,
          completedInvestments: 0,
        },
      },
    });
  } catch (error) {
    logger.error('Get investments error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch investments',
      error: error.message,
    });
  }
};

// Get single investment
exports.getInvestmentById = async (req, res) => {
  try {
    const investment = await Investment.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate('packageId', 'name type roiRate roiType duration description');

    if (!investment) {
      return res.status(404).json({
        status: 'error',
        message: 'Investment not found',
      });
    }

    // Get ROI history
    const roiHistory = investment.roiDistributions || [];

    res.status(200).json({
      status: 'success',
      data: {
        investment,
        roiHistory,
      },
    });
  } catch (error) {
    logger.error('Get investment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch investment',
      error: error.message,
    });
  }
};

// Get active investments summary
exports.getActiveInvestments = async (req, res) => {
  try {
    const userId = req.user.id;

    const investments = await Investment.find({
      userId,
      status: 'active',
    })
      .populate('packageId', 'name type roiRate')
      .select('amount totalROI totalROIPaid maturityDate createdAt');

    const summary = investments.reduce(
      (acc, inv) => {
        acc.totalInvested += inv.amount;
        acc.totalROIExpected += inv.totalROI;
        acc.totalROIReceived += inv.totalROIPaid;
        return acc;
      },
      { totalInvested: 0, totalROIExpected: 0, totalROIReceived: 0 }
    );

    res.status(200).json({
      status: 'success',
      data: {
        count: investments.length,
        investments,
        summary,
      },
    });
  } catch (error) {
    logger.error('Get active investments error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch active investments',
      error: error.message,
    });
  }
};

// Get ROI history
exports.getROIHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { investmentId } = req.params;

    const investment = await Investment.findOne({
      _id: investmentId,
      userId,
    });

    if (!investment) {
      return res.status(404).json({
        status: 'error',
        message: 'Investment not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        roiDistributions: investment.roiDistributions || [],
        totalROIPaid: investment.totalROIPaid,
        totalROI: investment.totalROI,
        remaining: investment.totalROI - investment.totalROIPaid,
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
