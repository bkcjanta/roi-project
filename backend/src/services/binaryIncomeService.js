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
   * Runs daily at 11:59 PM
   */
  async calculateDailyBinary() {
    try {
      logger.info('🎯 Starting daily binary income calculation...');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const settings = await SettingsHelper.getByPrefix('binary');

      if (!settings.enabled) {
        logger.info('⚠️ Binary income disabled');
        return { success: true, processed: 0 };
      }

      const pairValue = parseFloat(settings.pairValue || 1000);
      const commissionPerPair = parseFloat(settings.commissionPerPair || 100);
      const dailyCap = parseFloat(settings.dailyCap || 50000);

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

      logger.info(`Found ${users.length} users for binary calculation`);

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

      logger.info(`🎉 Binary calculation complete: ${processed} users, ₹${totalCommission}, ${errors} errors`);

      return { 
        success: true, 
        processed, 
        totalCommission,
        errors,
        total: users.length,
      };

    } catch (error) {
      logger.error('❌ Calculate binary error:', error);
      throw error;
    }
  }

  /**
   * Calculate binary for single user
   */
  async calculateUserBinary(user, cycleDate, pairValue, commissionPerPair, dailyCap) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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

      const binaryTxn = await BinaryTransaction.create([{
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
        status: 'calculated',
        metadata: {
          totalLeftMembers: user.binaryTeam.leftCount,
          totalRightMembers: user.binaryTeam.rightCount,
          weakerLeg: totalLeft < totalRight ? 'left' : 'right',
          strongerLeg: totalLeft > totalRight ? 'left' : 'right',
        },
      }], { session });

      user.binaryTeam.leftBusiness = 0;
      user.binaryTeam.rightBusiness = 0;
      user.binaryTeam.carryForward = newCarryForward;
      user.binaryTeam.totalPairs += pairsMatched;
      await user.save({ session });

      const commission = await Commission.create([{
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
        status: 'approved',
        binaryInfo: {
          leftBusiness: totalLeft,
          rightBusiness: totalRight,
          pairs: pairsMatched,
          pairValue: usedBusiness,
        },
      }], { session });

      binaryTxn[0].commissionId = commission[0]._id;
      await binaryTxn[0].save({ session });

      await session.commitTransaction();

      return { 
        commission: finalCommission, 
        pairs: pairsMatched,
        carryForward: newCarryForward,
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * ✅ SETUP CRON JOB
   * Runs daily at 11:59 PM IST
   */
  startCronJob() {
    // Cron expression: '59 23 * * *' = Every day at 11:59 PM
    cron.schedule('59 23 * * *', async () => {
      logger.info('⏰ Binary cron job triggered at 11:59 PM');
      try {
        await this.calculateDailyBinary();
      } catch (error) {
        logger.error('❌ Binary cron job failed:', error);
      }
    }, {
      timezone: 'Asia/Kolkata' // IST timezone
    });

    logger.info('✅ Binary cron job scheduled: Daily at 11:59 PM IST');
  }

  /**
   * ✅ MANUAL TRIGGER (for testing/admin)
   */
  async manualTrigger() {
    logger.info('🔧 Manual binary calculation triggered');
    return await this.calculateDailyBinary();
  }

  // Additional methods...
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
            status: 'paid',
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
            status: 'paid',
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

      const pending = await Commission.getTotalByUser(userId, 'binary', 'approved');

      return {
        currentBusiness: {
          left: user.binaryTeam.leftBusiness,
          right: user.binaryTeam.rightBusiness,
        },
        carryForward: user.binaryTeam.carryForward,
        totalPairs: user.binaryTeam.totalPairs,
        totalEarned: totalStats[0]?.totalEarned || 0,
        pendingAmount: pending.total,
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
