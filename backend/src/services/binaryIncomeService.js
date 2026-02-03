const mongoose = require('mongoose');
const cron = require('node-cron');
const User = require('../models/User');
const BinaryTransaction = require('../models/BinaryTransaction');
const Commission = require('../models/Commission');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const SettingsHelper = require('../utils/settingsHelper');
const logger = require('../utils/logger');

class BinaryIncomeService {

  /**
   * Update binary business when investment happens
   */
  async updateBinaryBusiness(investment) {
    try {
      logger.info(`🔄 Updating binary business for investment ${investment._id}`);

      const investor = await User.findById(investment.userId)
        .select('binaryParentId binaryPosition userCode');

      if (!investor || !investor.binaryParentId) {
        logger.info('⚠️ No binary parent found');
        return { success: true, updated: false };
      }

      const amount = parseFloat(investment.amount);

      await this.propagateBusinessUpline(
        investor.binaryParentId,
        investor.binaryPosition,
        amount
      );

      logger.info(`✅ Binary business updated: ₹${amount} to ${investor.binaryPosition} leg`);

      return { success: true, updated: true, amount };

    } catch (error) {
      logger.error('❌ Update binary business error:', error);
      throw error;
    }
  }

  /**
   * Propagate business up the binary tree
   */
  async propagateBusinessUpline(userId, position, amount) {
    let currentUser = await User.findById(userId);

    while (currentUser) {
      if (position === 'left') {
        currentUser.binaryTeam.leftBusiness = 
          parseFloat(currentUser.binaryTeam.leftBusiness) + amount;
      } else {
        currentUser.binaryTeam.rightBusiness = 
          parseFloat(currentUser.binaryTeam.rightBusiness) + amount;
      }

      await currentUser.save();

      logger.info(`📊 Updated ${currentUser.userCode}: ${position} leg += ₹${amount}`);

      if (!currentUser.binaryParentId) break;

      const parent = await User.findById(currentUser.binaryParentId);
      if (!parent) break;

      position = currentUser.binaryPosition;
      currentUser = parent;
    }
  }

  /**
   * ✅ CRON JOB: Calculate binary income for all users
   * Runs daily at 1:00 AM IST
   */
  async calculateDailyBinary() {
    try {
      logger.info('🎯 Starting daily binary income calculation...');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get settings with fallback
      let binarySettings = {
        enabled: true,
        pairValue: 1000,
        commissionPerPair: 100,
        dailyCap: 50000,
      };

      try {
        const settings = await SettingsHelper.getByPrefix('binary');
        if (settings) {
          binarySettings = {
            enabled: settings.enabled !== false,
            pairValue: parseFloat(settings.pairValue || 1000),
            commissionPerPair: parseFloat(settings.commissionPerPair || 100),
            dailyCap: parseFloat(settings.dailyCap || 50000),
          };
        }
      } catch (settingsError) {
        logger.warn('⚠️ Settings not found, using defaults');
      }

      if (!binarySettings.enabled) {
        logger.info('⚠️ Binary income disabled');
        return { success: true, processed: 0, message: 'Disabled' };
      }

      const { pairValue, commissionPerPair, dailyCap } = binarySettings;

      logger.info(`Settings: Pair=₹${pairValue}, Commission=₹${commissionPerPair}, Cap=₹${dailyCap}`);

      const users = await User.find({
        accountStatus: 'active',
        $or: [
          { 'binaryTeam.leftBusiness': { $gt: 0 } },
          { 'binaryTeam.rightBusiness': { $gt: 0 } },
          { 'binaryTeam.carryForward.left': { $gt: 0 } },
          { 'binaryTeam.carryForward.right': { $gt: 0 } },
        ],
      }).select('userCode binaryTeam');

      logger.info(`Found ${users.length} users for calculation`);

      let processed = 0;
      let totalCommission = 0;
      let errors = 0;

      for (const user of users) {
        try {
          const result = await this.calculateUserBinary(
            user,
            today,
            pairValue,
            commissionPerPair,
            dailyCap
          );

          if (result.commission > 0) {
            processed++;
            totalCommission += result.commission;
            logger.info(`✅ ${user.userCode}: ${result.pairs} pairs = ₹${result.commission}`);
          }
        } catch (error) {
          errors++;
          logger.error(`❌ Failed for ${user.userCode}:`, error.message);
        }
      }

      logger.info(`🎉 Complete: ${processed} users, ₹${totalCommission.toFixed(2)}, ${errors} errors`);

      return { 
        success: true, 
        processed, 
        totalCommission: parseFloat(totalCommission.toFixed(2)),
        errors,
        total: users.length,
      };

    } catch (error) {
      logger.error('❌ Calculate binary error:', error);
      throw error;
    }
  }

  /**
   * ✅ Calculate binary for single user WITH WALLET UPDATE
   */
  async calculateUserBinary(user, cycleDate, pairValue, commissionPerPair, dailyCap) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // === STEP 1: Calculate Binary Income ===
      const previousCarry = user.binaryTeam.carryForward || { left: 0, right: 0 };
      const prevLeft = parseFloat(previousCarry.left || 0);
      const prevRight = parseFloat(previousCarry.right || 0);

      const currentLeft = parseFloat(user.binaryTeam.leftBusiness || 0);
      const currentRight = parseFloat(user.binaryTeam.rightBusiness || 0);

      const totalLeft = currentLeft + prevLeft;
      const totalRight = currentRight + prevRight;

      const weakerLeg = Math.min(totalLeft, totalRight);
      const pairsMatched = Math.floor(weakerLeg / pairValue);

      if (pairsMatched === 0) {
        await session.abortTransaction();
        return { commission: 0, pairs: 0 };
      }

      const grossCommission = pairsMatched * commissionPerPair;
      let finalCommission = grossCommission;
      let cappingApplied = false;

      if (finalCommission > dailyCap) {
        finalCommission = dailyCap;
        cappingApplied = true;
      }

      const usedBusiness = pairsMatched * pairValue;
      const newCarryForward = {
        left: totalLeft > totalRight ? totalLeft - usedBusiness : 0,
        right: totalRight > totalLeft ? totalRight - usedBusiness : 0,
      };

      const transactionId = `BIN${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      logger.info(`💰 ${user.userCode}: ${pairsMatched} pairs × ₹${commissionPerPair} = ₹${finalCommission}`);

      // === STEP 2: Update Wallet (CRITICAL!) ===
      const wallet = await Wallet.findOne({ userId: user._id }).session(session);
      
      if (!wallet) {
        throw new Error(`Wallet not found for user ${user.userCode}`);
      }

      const balanceBefore = parseFloat(wallet.binaryBalance || 0);
      const balanceAfter = balanceBefore + finalCommission; // ✅ Explicit variable

      wallet.binaryBalance = balanceAfter;
      wallet.totalBinaryIncome = parseFloat(wallet.totalBinaryIncome || 0) + finalCommission;
      wallet.totalEarnings = parseFloat(wallet.totalEarnings || 0) + finalCommission;
      wallet.updatedAt = new Date();
      
      await wallet.save({ session });

      logger.info(`✅ Wallet: ₹${balanceBefore} → ₹${balanceAfter}`); // ✅ Added logging

      // === STEP 3: Create Binary Transaction ===
      const binaryTxn = await BinaryTransaction.create([{
        transactionId: transactionId,
        userId: user._id,
        userCode: user.userCode,
        cycleDate: cycleDate,
        leftBusiness: currentLeft,
        rightBusiness: currentRight,
        previousCarryForward: previousCarry,
        totalLeftBusiness: totalLeft,
        totalRightBusiness: totalRight,
        pairValue: pairValue,
        pairsMatched: pairsMatched,
        commissionPerPair: commissionPerPair,
        grossCommission: grossCommission,
        cappingApplied: cappingApplied,
        cappingLimit: dailyCap,
        finalCommission: finalCommission,
        newCarryForward: newCarryForward,
        status: 'completed',
        processedAt: new Date(),
        metadata: {
          totalLeftMembers: user.binaryTeam.leftCount,
          totalRightMembers: user.binaryTeam.rightCount,
          weakerLeg: totalLeft < totalRight ? 'left' : 'right',
          strongerLeg: totalLeft > totalRight ? 'left' : 'right',
          walletBalanceBefore: balanceBefore,  // ✅ Added
          walletBalanceAfter: balanceAfter,    // ✅ Added
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }], { session });

      // === STEP 4: Update User Binary Stats ===
      user.binaryTeam.leftBusiness = 0;
      user.binaryTeam.rightBusiness = 0;
      user.binaryTeam.carryForward = newCarryForward;
      user.binaryTeam.totalPairs += pairsMatched;
      await user.save({ session });

      // === STEP 5: Create Commission ===
      const commission = await Commission.create([{
        commissionId: `COM-BIN${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        userId: user._id,
        userCode: user.userCode,
        fromUserId: user._id,
        fromUserCode: user.userCode,
        type: 'binary',
        amount: finalCommission,
        percentage: (commissionPerPair / pairValue) * 100,
        sourceType: 'binary_pairing',
        sourceId: binaryTxn[0]._id,
        sourceAmount: usedBusiness,
        status: 'paid',
        paidAt: new Date(),
        transactionId: transactionId,
        metadata: {
          leftBusiness: totalLeft,
          rightBusiness: totalRight,
          pairs: pairsMatched,
          pairValue: usedBusiness,
          carryLeft: newCarryForward.left,      // ✅ Added
          carryRight: newCarryForward.right,    // ✅ Added
          cappingApplied: cappingApplied,       // ✅ Added
          grossCommission: grossCommission,     // ✅ Added
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }], { session });

      // === STEP 6: Create Transaction ===
      await Transaction.create([{
        transactionId: transactionId,
        userId: user._id,
        userCode: user.userCode,
        type: 'binary_income',
        amount: finalCommission,
        fee: 0,
        netAmount: finalCommission,
        walletType: 'binary',
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        status: 'completed',
        metadata: {
          leftBusiness: totalLeft,
          rightBusiness: totalRight,
          pairValue: usedBusiness,
          pairs: pairsMatched,
          percentage: (commissionPerPair / pairValue) * 100,
          carryLeft: newCarryForward.left,
          carryRight: newCarryForward.right,
          binaryTransactionId: binaryTxn[0]._id,
          commissionId: commission[0]._id,
          cappingApplied: cappingApplied,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }], { session });

      // === STEP 7: Link Records ===
      binaryTxn[0].commissionId = commission[0]._id;
      await binaryTxn[0].save({ session });

      await session.commitTransaction();

      logger.info(`🎉 ${user.userCode}: Completed successfully!`);

      return { 
        commission: finalCommission, 
        pairs: pairsMatched,
        carryForward: newCarryForward,
        walletBalance: balanceAfter,
      };

    } catch (error) {
      await session.abortTransaction();
      logger.error(`❌ Binary failed for ${user.userCode}:`, error.message); // ✅ Enhanced error
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * ✅ SETUP CRON JOB - Runs daily at 1:00 AM IST
   */
  startCronJob() {
    cron.schedule('0 1 * * *', async () => {
      const startTime = new Date();
      logger.info('⏰ Binary cron started:', startTime.toISOString());
      
      try {
        const result = await this.calculateDailyBinary();
        
        const duration = ((new Date() - startTime) / 1000).toFixed(2);
        logger.info(`✅ Binary cron completed in ${duration}s:`, result);
        
      } catch (error) {
        logger.error('❌ Binary cron failed:', error);
      }
    }, {
      timezone: 'Asia/Kolkata',
      scheduled: true,
    });

    logger.info('✅ Binary cron scheduled: Daily at 1:00 AM IST');
    return true;
  }

  /**
   * ✅ Manual trigger for testing
   */
  async manualTrigger() {
    logger.info('🔧 Manual binary calculation triggered');
    return await this.calculateDailyBinary();
  }

  async getUserBinaryHistory(userId, options = {}) {
    try {
      const { page = 1, limit = 20, status } = options;
      const filter = { userId };
      if (status) filter.status = status;
      const skip = (page - 1) * limit;

      const transactions = await BinaryTransaction.find(filter)
        .sort({ cycleDate: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await BinaryTransaction.countDocuments(filter);

      const stats = await BinaryTransaction.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(userId),
            status: 'completed',
          } 
        },
        {
          $group: {
            _id: null,
            totalCommission: { $sum: { $toDouble: '$finalCommission' } },
            totalPairs: { $sum: '$pairsMatched' },
            count: { $sum: 1 },
          },
        },
      ]);

      return {
        transactions,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
        stats: stats[0] || { totalCommission: 0, totalPairs: 0, count: 0 },
      };

    } catch (error) {
      logger.error('Get binary history error:', error);
      throw error;
    }
  }

  async getBinarySummary(userId) {
    try {
      const user = await User.findById(userId).select('userCode binaryTeam');

      const totalStats = await BinaryTransaction.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(userId),
            status: 'completed',
          } 
        },
        {
          $group: {
            _id: null,
            totalEarned: { $sum: { $toDouble: '$finalCommission' } },
            totalPairs: { $sum: '$pairsMatched' },
            transactions: { $sum: 1 },
          },
        },
      ]);

      return {
        currentBusiness: {
          left: user.binaryTeam.leftBusiness,
          right: user.binaryTeam.rightBusiness,
        },
        carryForward: user.binaryTeam.carryForward,
        totalPairs: user.binaryTeam.totalPairs,
        totalEarned: totalStats[0]?.totalEarned || 0,
        teamCount: {
          left: user.binaryTeam.leftCount,
          right: user.binaryTeam.rightCount,
        },
      };

    } catch (error) {
      logger.error('Get binary summary error:', error);
      throw error;
    }
  }
}

module.exports = new BinaryIncomeService();
