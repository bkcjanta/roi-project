const mongoose = require('mongoose');
const Investment = require('../models/Investment');
const Package = require('../models/Package');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const logger = require('../utils/logger');
const levelIncomeService = require('../services/levelIncomeService');
const binaryIncomeService = require('../services/binaryIncomeService');
const SettingsHelper = require('../utils/settingsHelper');

// ==================== CREATE INVESTMENT ====================
exports.createInvestment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { packageId, amount } = req.body;
    const userId = req.user.id;

    // Validation
    if (!packageId || !amount) {
      await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: 'Please provide package and amount',
      });
    }

    // Get package
    const pkg = await Package.findById(packageId).session(session);
    if (!pkg || !pkg.isActive) {
      await session.abortTransaction();
      return res.status(404).json({
        status: 'error',
        message: 'Package not found or inactive',
      });
    }

    // Validate amount
    const minAmt = parseFloat(pkg.minAmount);
    const maxAmt = pkg.maxAmount ? parseFloat(pkg.maxAmount) : null;
    
    if (amount < minAmt || (maxAmt && amount > maxAmt)) {
      await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: `Amount must be between ₹${minAmt} and ₹${maxAmt || 'unlimited'}`,
      });
    }

    // Get user and wallet
    const user = await User.findById(userId).session(session);
    const wallet = await Wallet.findOne({ userId }).session(session);
    
    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found',
      });
    }

    // Check balance
    if (wallet.mainBalance < amount) {
      await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: `Insufficient balance. Available: ₹${wallet.mainBalance}`,
      });
    }

    // Calculate dates and amounts
    const startDate = new Date();
    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + pkg.duration);
    
    const nextRoiDate = new Date();
    nextRoiDate.setDate(nextRoiDate.getDate() + 1);

    const dailyRoiAmount = (amount * pkg.roiRate) / 100;
    const totalRoiCap = (amount * pkg.roiCap) / 100;

    // Generate unique transaction ID
    const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // ========== STEP 1: Create Investment ==========
    const investment = await Investment.create([{
      userId,
      packageId,
      packageName: pkg.name,
      amount,
      type: pkg.type,
      roiRate: pkg.roiRate,
      roiCap: pkg.roiCap,
      duration: pkg.duration,
      dailyRoiAmount,
      totalRoiCap,
      startDate,
      maturityDate,
      nextRoiDate,
      status: 'active',
    }], { session });

    // ========== STEP 2: Create Transaction ==========
    const transaction = await Transaction.create([{
      userId,
      userCode: user.userCode,
      transactionId,
      type: 'investment_debit',
      amount,
      fee: 0,
      netAmount: amount,
      walletType: 'main',
      balanceBefore: wallet.mainBalance,
      balanceAfter: wallet.mainBalance - amount,
      status: 'completed',
      metadata: {
        packageId,
        packageName: pkg.name,
        investmentId: investment[0]._id,
      },
    }], { session });

    // ========== STEP 3: Update Wallet ==========
    wallet.mainBalance -= amount;
    wallet.totalInvested += amount;
    await wallet.save({ session });

    // Link transaction to investment
    investment[0].transactionId = transaction[0]._id;
    await investment[0].save({ session });

    // ========== STEP 4: CREATE LEVEL INCOME COMMISSIONS ==========
    let commissions = [];
    const levelSettings = await SettingsHelper.getByPrefix('levelIncome');
    
    if (levelSettings.enabled && amount >= (levelSettings.minInvestment || 1000)) {
      const levelConfig = levelSettings.levels || [];
      
      try {
        commissions = await levelIncomeService.createCommissionRecords(
          investment[0],
          session,
          levelConfig
        );

        logger.info(`✅ Created ${commissions.length} level income commissions`);
      } catch (commError) {
        logger.error('❌ Commission creation failed:', commError);
        // Don't fail transaction, just log error
      }
    }

    // ========== COMMIT TRANSACTION ==========
    await session.commitTransaction();

    logger.info(`✅ Investment created: User ${user.userCode}, Amount ₹${amount}, ID ${investment[0]._id}`);

    // ========== STEP 5: UPDATE BINARY BUSINESS (Non-blocking) ==========
    const binarySettings = await SettingsHelper.getByPrefix('binary');
    
    if (binarySettings.enabled) {
      // Run in background after response sent
      setImmediate(async () => {
        try {
          await binaryIncomeService.updateBinaryBusiness(investment[0]);
          logger.info(`✅ Binary business updated for investment ${investment[0]._id}`);
        } catch (binaryError) {
          logger.error('❌ Binary business update failed:', binaryError);
        }
      });
    }

    // ========== RESPONSE ==========
    res.status(201).json({
      status: 'success',
      message: 'Investment created successfully',
      data: {
        investment: investment[0],
        transaction: {
          transactionId: transaction[0].transactionId,
          status: transaction[0].status,
        },
        wallet: {
          mainBalance: wallet.mainBalance,
          totalInvested: wallet.totalInvested,
        },
        commissions: {
          levelIncomeCreated: commissions.length,
          binaryUpdateQueued: binarySettings.enabled,
        },
      },
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('❌ Create investment error:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to create investment',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// ==================== GET MY INVESTMENTS ====================
exports.getMyInvestments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = { userId };
    
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
          userId: new mongoose.Types.ObjectId(userId)
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

// ==================== GET SINGLE INVESTMENT ====================
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

// ==================== GET ACTIVE INVESTMENTS ====================
exports.getActiveInvestments = async (req, res) => {
  try {
    const userId = req.user.id;

    const investments = await Investment.find({
      userId,
      status: 'active',
    })
      .populate('packageId', 'name type roiRate')
      .select('amount totalRoiCap totalRoiPaid maturityDate createdAt')
      .sort({ createdAt: -1 });

    const summary = investments.reduce(
      (acc, inv) => {
        acc.totalInvested += inv.amount;
        acc.totalROIExpected += inv.totalRoiCap || 0;
        acc.totalROIReceived += inv.totalRoiPaid || 0;
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

// ==================== GET ROI HISTORY ====================
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
        totalROIPaid: investment.totalRoiPaid || 0,
        totalROICap: investment.totalRoiCap || 0,
        remaining: (investment.totalRoiCap || 0) - (investment.totalRoiPaid || 0),
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

// ==================== GET INVESTMENT STATS ====================
exports.getInvestmentStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await Investment.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
              },
            },
          ],
          byPackage: [
            {
              $group: {
                _id: '$packageName',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
              },
            },
          ],
          overall: [
            {
              $group: {
                _id: null,
                totalInvestments: { $sum: 1 },
                totalInvested: { $sum: '$amount' },
                totalROIPaid: { $sum: '$totalRoiPaid' },
                avgInvestment: { $avg: '$amount' },
              },
            },
          ],
        },
      },
    ]);

    res.status(200).json({
      status: 'success',
      data: stats[0],
    });
  } catch (error) {
    logger.error('Get investment stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch investment stats',
      error: error.message,
    });
  }
};
