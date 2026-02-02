const mongoose = require('mongoose');
const User = require('../models/User');
const Commission = require('../models/Commission');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const SettingsHelper = require('../utils/settingsHelper');
const logger = require('../utils/logger');

class LevelIncomeService {

  /**
   * Create commission records when investment happens
   * Uses pre-built uplineChain for SUPER FAST calculation
   * Records created atomically with investment (same transaction)
   * @param {Object} investment - Investment object
   * @param {Object} session - Mongoose session for transaction
   * @param {Array} levelConfig - Level configuration
   * @returns {Array} Created commission records
   */
  async createCommissionRecords(investment, session, levelConfig) {
    try {
      logger.info(`💰 Creating level income commissions for investment ${investment._id}`);

      const commissions = [];
      
      // Get investor with pre-built upline chain
      const investor = await User.findById(investment.userId)
        .select('uplineChain userCode')
        .session(session);

      if (!investor || !investor.uplineChain || investor.uplineChain.length === 0) {
        logger.info('⚠️ No upline chain found');
        return [];
      }

      logger.info(`Found ${investor.uplineChain.length} upline levels`);

      // Loop through pre-built upline (SUPER FAST - No recursive queries!)
      for (const upline of investor.uplineChain) {
        const levelInfo = levelConfig.find(l => l.level === upline.level);
        
        if (!levelInfo) {
          logger.warn(`No level config for level ${upline.level}`);
          continue;
        }

        // Calculate commission amount
        const commissionAmount = (parseFloat(investment.amount) * levelInfo.percentage) / 100;

        // Create commission record (within same transaction as investment)
        const commission = await Commission.create([{
          userId: upline.userId,
          userCode: upline.userCode,
          fromUserId: investor._id,
          fromUserCode: investor.userCode,
          type: 'level',
          amount: commissionAmount,
          percentage: levelInfo.percentage,
          level: upline.level,
          sourceType: 'investment',
          sourceId: investment._id,
          sourceAmount: investment.amount,
          status: 'approved', // Auto-approved, ready for payment
        }], { session });

        commissions.push(commission[0]);

        logger.info(`✅ Level ${upline.level} commission: ₹${commissionAmount} for ${upline.userCode}`);
      }

      logger.info(`🎉 Created ${commissions.length} level income commissions`);

      return commissions;

    } catch (error) {
      logger.error('❌ Create commission records error:', error);
      throw error;
    }
  }

  /**
   * Process pending commissions (background job)
   * Credits approved commissions to wallet
   * Can be triggered manually or by cron
   * @returns {Object} Processing result
   */
  async processPendingCommissions() {
    try {
      logger.info('🔄 Processing pending level income commissions...');

      // Get all approved but unpaid commissions
      const pendingCommissions = await Commission.find({
        type: 'level',
        status: 'approved',
        transactionId: { $exists: false },
      }).limit(100); // Process in batches

      if (pendingCommissions.length === 0) {
        logger.info('✅ No pending commissions to process');
        return { processed: 0, failed: 0, totalAmount: 0 };
      }

      let processed = 0;
      let failed = 0;
      let totalAmount = 0;

      for (const commission of pendingCommissions) {
        try {
          const result = await this.creditCommission(commission);
          
          if (result.success) {
            processed++;
            totalAmount += parseFloat(commission.amount);
          }
        } catch (error) {
          logger.error(`Failed to credit commission ${commission.commissionId}:`, error);
          failed++;
        }
      }

      logger.info(`✅ Processed: ${processed}, Failed: ${failed}, Total: ₹${totalAmount}`);

      return { 
        processed, 
        failed, 
        totalAmount,
        total: pendingCommissions.length,
      };

    } catch (error) {
      logger.error('❌ Process commissions error:', error);
      throw error;
    }
  }

  /**
   * Credit single commission to wallet
   * @param {Object} commission - Commission object
   * @returns {Object} Credit result
   */
  async creditCommission(commission) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Double-check if already paid
      if (commission.transactionId) {
        logger.info(`Commission ${commission.commissionId} already paid`);
        await session.abortTransaction();
        return { success: true, alreadyPaid: true };
      }

      // Get wallet
      const wallet = await Wallet.findOne({ userId: commission.userId }).session(session);
      
      if (!wallet) {
        throw new Error(`Wallet not found for user ${commission.userCode}`);
      }

      const amount = parseFloat(commission.amount);

      // Update wallet
      wallet.levelBalance += amount;
      wallet.totalLevelIncome += amount;
      wallet.totalEarnings += amount;
      await wallet.save({ session });

      // Create transaction
      const transaction = await Transaction.create([{
        userId: commission.userId,
        userCode: commission.userCode,
        type: 'level_income',
        amount: amount,
        walletType: 'level',
        balanceBefore: wallet.levelBalance - amount,
        balanceAfter: wallet.levelBalance,
        status: 'completed',
        description: `Level ${commission.level} income from ${commission.fromUserCode}`,
        metadata: {
          commissionId: commission._id,
          fromUserId: commission.fromUserId,
          level: commission.level,
          sourceAmount: parseFloat(commission.sourceAmount),
          percentage: commission.percentage,
        },
      }], { session });

      // Update commission
      commission.status = 'paid';
      commission.paidAt = new Date();
      commission.transactionId = transaction[0]._id;
      await commission.save({ session });

      await session.commitTransaction();
      
      logger.info(`✅ Commission credited: ₹${amount} to ${commission.userCode}`);

      return { success: true, transaction: transaction[0] };

    } catch (error) {
      await session.abortTransaction();
      logger.error('❌ Credit commission error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get user's level income history
   * @param {String} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Level income data
   */
  async getUserLevelIncome(userId, options = {}) {
    try {
      const { page = 1, limit = 20, status } = options;

      const filter = { userId, type: 'level' };
      if (status) filter.status = status;

      const skip = (page - 1) * limit;

      // Get commissions
      const commissions = await Commission.find(filter)
        .populate('fromUserId', 'fullName userCode email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Commission.countDocuments(filter);

      // Get stats by status
      const stats = await Commission.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(userId), 
            type: 'level' 
          } 
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: { $toDouble: '$amount' } },
          },
        },
      ]);

      // Level-wise breakdown (paid only)
      const levelStats = await Commission.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(userId), 
            type: 'level', 
            status: 'paid' 
          } 
        },
        {
          $group: {
            _id: '$level',
            count: { $sum: 1 },
            totalAmount: { $sum: { $toDouble: '$amount' } },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return {
        commissions,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
        stats,
        levelStats,
      };

    } catch (error) {
      logger.error('Get level income error:', error);
      throw error;
    }
  }

  /**
   * Get level income summary for user
   * @param {String} userId - User ID
   * @returns {Object} Summary data
   */
  async getLevelIncomeSummary(userId) {
    try {
      // Total earned (paid)
      const totalEarned = await Commission.getTotalByUser(userId, 'level', 'paid');

      // Pending amount
      const pending = await Commission.getTotalByUser(userId, 'level', 'approved');

      // Level-wise breakdown
      const levelWise = await Commission.getLevelWiseStats(userId);

      // Recent commissions (last 10)
      const recent = await Commission.find({
        userId,
        type: 'level',
        status: 'paid',
      })
        .populate('fromUserId', 'userCode fullName')
        .sort({ paidAt: -1 })
        .limit(10);

      return {
        totalEarned: totalEarned.total,
        totalCount: totalEarned.count,
        pendingAmount: pending.total,
        pendingCount: pending.count,
        levelWise: levelWise,
        recentCommissions: recent,
      };

    } catch (error) {
      logger.error('Get level income summary error:', error);
      throw error;
    }
  }

  /**
   * Check if user is eligible for commission
   * (Optional: Can add rules like "must have active investment")
   * @param {String} userId - User ID
   * @returns {Boolean} Eligibility status
   */
  async checkEligibility(userId) {
    try {
      const user = await User.findById(userId).select('accountStatus');
      
      if (!user || user.accountStatus !== 'active') {
        return false;
      }

      // Optional: Check if user has active investment
      // const Investment = require('../models/Investment');
      // const activeInvestment = await Investment.findOne({
      //   userId: userId,
      //   status: 'active',
      // });
      // return !!activeInvestment;

      return true;

    } catch (error) {
      logger.error('Check eligibility error:', error);
      return false;
    }
  }

  /**
   * Get team performance (for admins)
   * @param {String} userId - User ID
   * @returns {Object} Team performance data
   */
  async getTeamPerformance(userId) {
    try {
      // Get all commissions generated by user's team
      const teamCommissions = await Commission.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            type: 'level',
            status: 'paid',
          },
        },
        {
          $group: {
            _id: '$fromUserId',
            totalGenerated: { $sum: { $toDouble: '$amount' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalGenerated: -1 } },
        { $limit: 10 },
      ]);

      // Populate user details
      const User = require('../models/User');
      for (let item of teamCommissions) {
        const user = await User.findById(item._id).select('userCode fullName');
        item.user = user;
      }

      return {
        topPerformers: teamCommissions,
      };

    } catch (error) {
      logger.error('Get team performance error:', error);
      throw error;
    }
  }
}

module.exports = new LevelIncomeService();
