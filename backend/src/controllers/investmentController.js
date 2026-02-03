const mongoose = require('mongoose');
const Investment = require('../models/Investment');
const Package = require('../models/Package');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Commission = require('../models/Commission');
const logger = require('../utils/logger');
const levelIncomeService = require('../services/levelIncomeService');
const binaryIncomeService = require('../services/binaryIncomeService');

// ==================== CREATE INVESTMENT ====================
exports.createInvestment = async (req, res) => {
  const useTransactions = process.env.USE_TRANSACTIONS === 'true';
  let session = null;

  if (useTransactions) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      logger.info('🔄 Using transactions (Enabled via config)');
    } catch (error) {
      logger.warn('⚠️  Failed to start transaction, continuing without it');
      session = null;
    }
  } else {
    logger.warn('⚠️  Transactions disabled (Local development mode)');
  }

  try {
    const { packageId, amount } = req.body;
    const userId = req.user.id;

    // Validation
    if (!packageId || !amount) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: 'Please provide package and amount',
      });
    }

    // Get package
    const pkg = session 
      ? await Package.findById(packageId).session(session)
      : await Package.findById(packageId);
      
    if (!pkg || !pkg.isActive) {
      if (session) await session.abortTransaction();
      return res.status(404).json({
        status: 'error',
        message: 'Package not found or inactive',
      });
    }

    // Validate amount
    const minAmt = parseFloat(pkg.minAmount);
    const maxAmt = pkg.maxAmount ? parseFloat(pkg.maxAmount) : null;
    
    if (amount < minAmt || (maxAmt && amount > maxAmt)) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: `Amount must be between ₹${minAmt} and ₹${maxAmt || 'unlimited'}`,
      });
    }

    // Get user and wallet
    const user = session 
      ? await User.findById(userId).session(session)
      : await User.findById(userId);
      
    const wallet = session
      ? await Wallet.findOne({ userId }).session(session)
      : await Wallet.findOne({ userId });
    
    if (!wallet) {
      if (session) await session.abortTransaction();
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found',
      });
    }

    // Check balance
    const mainBalance = parseFloat(wallet.mainBalance);
    if (mainBalance < amount) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: `Insufficient balance. Available: ₹${mainBalance}`,
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
    const investmentData = {
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
      transactionId,
    };

    const investment = session
      ? await Investment.create([investmentData], { session })
      : await Investment.create(investmentData);

    const createdInvestment = session ? investment[0] : investment;

    // ========== STEP 2: Create Transaction ==========
    const transactionData = {
      userId,
      userCode: user.userCode,
      transactionId,
      type: 'investment_debit',
      amount: -amount,
      fee: 0,
      netAmount: -amount,
      walletType: 'main',
      balanceBefore: mainBalance,
      balanceAfter: mainBalance - amount,
      status: 'completed',
      metadata: {
        packageId,
        packageName: pkg.name,
        investmentId: createdInvestment._id,
      },
    };

    const transaction = session
      ? await Transaction.create([transactionData], { session })
      : await Transaction.create(transactionData);

    const createdTransaction = session ? transaction[0] : transaction;

    // ========== STEP 3: Update Wallet ==========
    wallet.mainBalance = mainBalance - amount;
    wallet.totalInvested = parseFloat(wallet.totalInvested || 0) + amount;
    
    if (session) {
      await wallet.save({ session });
    } else {
      await wallet.save();
    }

    // ========== STEP 4: DIRECT REFERRAL INCOME (10% INSTANT) ==========
    let directReferralPaid = false;
    let directReferralAmount = 0;

    if (user.sponsorId) {
      try {
        const directCommissionRate = 10; // 10% instant
        directReferralAmount = (amount * directCommissionRate) / 100;

        // Get sponsor
        const sponsor = session
          ? await User.findById(user.sponsorId).session(session)
          : await User.findById(user.sponsorId);
        
        if (sponsor && sponsor.isActive && sponsor.accountStatus === 'active') {
          // Get sponsor wallet
          const sponsorWallet = session
            ? await Wallet.findOne({ userId: sponsor._id }).session(session)
            : await Wallet.findOne({ userId: sponsor._id });

          if (sponsorWallet) {
            const oldReferralBalance = parseFloat(sponsorWallet.referralBalance || 0);
            const newReferralBalance = oldReferralBalance + directReferralAmount;

            // Update sponsor wallet
            sponsorWallet.referralBalance = newReferralBalance;
            sponsorWallet.totalReferralIncome = parseFloat(sponsorWallet.totalReferralIncome || 0) + directReferralAmount;
            sponsorWallet.totalEarnings = parseFloat(sponsorWallet.totalEarnings || 0) + directReferralAmount;

            if (session) {
              await sponsorWallet.save({ session });
            } else {
              await sponsorWallet.save();
            }

            // Create Transaction for sponsor
            const refTxnId = `REF${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            
            const refTransactionData = {
              transactionId: refTxnId,
              userId: sponsor._id,
              userCode: sponsor.userCode,
              type: 'referral_income',
              amount: directReferralAmount,
              fee: 0,
              netAmount: directReferralAmount,
              walletType: 'referral',
              balanceBefore: oldReferralBalance,
              balanceAfter: newReferralBalance,
              status: 'completed',
              metadata: {
                fromUserId: user._id,
                fromUserCode: user.userCode,
                investmentId: createdInvestment._id,
                investmentAmount: amount,
                commissionRate: directCommissionRate,
                commissionType: 'direct_referral_instant',
              },
            };

            if (session) {
              await Transaction.create([refTransactionData], { session });
            } else {
              await Transaction.create(refTransactionData);
            }

            // Generate Commission ID
            const commissionId = `COM-${Date.now().toString(36).toUpperCase()}${Math.random()
              .toString(36)
              .substring(2, 6)
              .toUpperCase()}`;

            // Create Commission Record
            const commissionData = {
              commissionId: commissionId,
              userId: sponsor._id,
              userCode: sponsor.userCode,
              fromUserId: user._id,
              fromUserCode: user.userCode,
              type: 'directreferral',
              amount: directReferralAmount,
              percentage: directCommissionRate,
              sourceType: 'investment',
              sourceId: createdInvestment._id,
              sourceAmount: amount,
              status: 'paid',
              paidAt: new Date(),
              transactionId: refTxnId,
              metadata: {
                packageName: pkg.name,
                note: 'Direct referral commission (10% instant on investment)',
              },
            };

            if (session) {
              await Commission.create([commissionData], { session });
            } else {
              await Commission.create(commissionData);
            }

            directReferralPaid = true;
            logger.info(`✅ Direct referral income (INSTANT): ₹${directReferralAmount} paid to ${sponsor.userCode} (from ${user.userCode})`);
          }
        }
      } catch (refError) {
        logger.error('❌ Direct referral income failed:', refError);
        // Don't fail transaction
      }
    }

    // ========== STEP 5: CREATE LEVEL INCOME COMMISSIONS (Level 2-5 only) ==========
    let commissions = [];
    
    try {
      commissions = await levelIncomeService.createCommissionRecords(
        createdInvestment,
        session
      );

      logger.info(`✅ Created ${commissions.length} level income commissions (Level 2-5)`);
    } catch (commError) {
      logger.error('❌ Commission creation failed:', commError);
    }

    // ========== COMMIT TRANSACTION ==========
    if (session) {
      await session.commitTransaction();
      logger.info('✅ Transaction committed');
    }

    logger.info(`✅ Investment created: User ${user.userCode}, Amount ₹${amount}, ID ${createdInvestment._id}`);

    // ========== STEP 6: UPDATE BINARY BUSINESS (Non-blocking) ==========
    setImmediate(async () => {
      try {
        await binaryIncomeService.updateBinaryBusiness(createdInvestment);
        logger.info(`✅ Binary business updated for investment ${createdInvestment._id}`);
      } catch (binaryError) {
        logger.error('❌ Binary business update failed:', binaryError);
      }
    });

    // ========== RESPONSE ==========
    res.status(201).json({
      status: 'success',
      message: 'Investment created successfully',
      data: {
        investment: {
          id: createdInvestment._id,
          userId: createdInvestment.userId,
          packageName: createdInvestment.packageName,
          amount: createdInvestment.amount,
          roiRate: createdInvestment.roiRate,
          duration: createdInvestment.duration,
          dailyRoiAmount: createdInvestment.dailyRoiAmount,
          totalRoiCap: createdInvestment.totalRoiCap,
          nextRoiDate: createdInvestment.nextRoiDate,
          status: createdInvestment.status,
        },
        transaction: {
          transactionId: createdTransaction.transactionId,
          status: createdTransaction.status,
        },
        wallet: {
          mainBalance: wallet.mainBalance,
          totalInvested: wallet.totalInvested,
        },
        commissions: {
          directReferralPaid: directReferralPaid,
          directReferralAmount: directReferralAmount,
          levelIncomeCreated: commissions.length,
        },
      },
    });

  } catch (error) {
    if (session) await session.abortTransaction();
    logger.error('❌ Create investment error:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to create investment',
      error: error.message,
    });
  } finally {
    if (session) session.endSession();
  }
};

// ==================== GET MY INVESTMENTS ====================
exports.getMyInvestments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { userId };
    
    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const investments = await Investment.find(filter)
      .populate('packageId', 'name type roiRate duration')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Investment.countDocuments(filter);

    const stats = await Investment.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId)
        } 
      },
      {
        $group: {
          _id: null,
          totalInvested: { $sum: { $toDouble: '$amount' } },
          totalRoiEarned: { $sum: { $toDouble: '$totalRoiPaid' } },
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
    }).populate('packageId', 'name type roiRate duration description');

    if (!investment) {
      return res.status(404).json({
        status: 'error',
        message: 'Investment not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        investment,
        roiHistory: investment.roiDistributions || [],
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
        acc.totalInvested += parseFloat(inv.amount || 0);
        acc.totalROIExpected += parseFloat(inv.totalRoiCap || 0);
        acc.totalROIReceived += parseFloat(inv.totalRoiPaid || 0);
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
        totalROIPaid: parseFloat(investment.totalRoiPaid || 0),
        totalROICap: parseFloat(investment.totalRoiCap || 0),
        remaining: parseFloat(investment.totalRoiCap || 0) - parseFloat(investment.totalRoiPaid || 0),
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
                totalAmount: { $sum: { $toDouble: '$amount' } },
              },
            },
          ],
          byPackage: [
            {
              $group: {
                _id: '$packageName',
                count: { $sum: 1 },
                totalAmount: { $sum: { $toDouble: '$amount' } },
              },
            },
          ],
          overall: [
            {
              $group: {
                _id: null,
                totalInvestments: { $sum: 1 },
                totalInvested: { $sum: { $toDouble: '$amount' } },
                totalROIPaid: { $sum: { $toDouble: '$totalRoiPaid' } },
                avgInvestment: { $avg: { $toDouble: '$amount' } },
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
