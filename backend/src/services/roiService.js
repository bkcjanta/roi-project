const mongoose = require('mongoose');
const cron = require('node-cron');
const Investment = require('../models/Investment');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const IncomeDistribution = require('../models/IncomeDistribution');
const User = require('../models/User');
const logger = require('../utils/logger');

class RoiService {
  
  // Main function to distribute daily ROI
  async distributeROI() {
    try {
      logger.info('🎯 Starting ROI distribution process...');
      
      // Get current server time
      const now = new Date();
      logger.info(`🕐 Current server time: ${now.toISOString()}`);

      // Find all active investments where nextRoiDate <= now
      const investments = await Investment.find({
        status: 'active',
        nextRoiDate: { $lte: now },
      }).populate('userId packageId');

      logger.info(`📊 Found ${investments.length} investments eligible for ROI`);

      // Debug: Show why no investments found (only if zero)
      if (investments.length === 0) {
        const allActive = await Investment.find({ status: 'active' })
          .select('_id userId nextRoiDate status daysCompleted totalRoiPaid totalRoiCap')
          .limit(5);
        
        if (allActive.length > 0) {
          logger.warn('⚠️  No eligible investments found for ROI distribution!');
          logger.warn(`📋 Sample of ${allActive.length} active investments:`);
          
          allActive.forEach(inv => {
            const nextRoi = inv.nextRoiDate ? inv.nextRoiDate.toISOString() : 'null';
            const isPast = inv.nextRoiDate ? (inv.nextRoiDate <= now ? '✅ ELIGIBLE' : '❌ FUTURE') : '⚠️  NULL';
            logger.warn(`   ID: ${inv._id.toString().slice(-8)}`);
            logger.warn(`     nextRoiDate: ${nextRoi} ${isPast}`);
            logger.warn(`     Progress: Day ${inv.daysCompleted}, Paid: ₹${inv.totalRoiPaid}/${inv.totalRoiCap}`);
          });
        } else {
          logger.info('ℹ️  No active investments in database');
        }
      }

      let successCount = 0;
      let failCount = 0;
      let totalRoiDistributed = 0;

      // Process each investment
      for (const investment of investments) {
        try {
          await this.processInvestmentROI(investment);
          successCount++;
          totalRoiDistributed += investment.dailyRoiAmount;
        } catch (error) {
          logger.error(`❌ Failed to process investment ${investment._id}:`, error.message);
          failCount++;
        }
      }

      logger.info(`✅ ROI Distribution Complete:`);
      logger.info(`   Processed: ${investments.length}`);
      logger.info(`   Success: ${successCount}`);
      logger.info(`   Failed: ${failCount}`);
      logger.info(`   Total ROI: ₹${totalRoiDistributed}`);

      return {
        success: true,
        processed: investments.length,
        successCount,
        failCount,
        totalAmount: totalRoiDistributed,
      };

    } catch (error) {
      logger.error('❌ ROI distribution error:', error);
      throw error;
    }
  }

  // Process individual investment ROI
 // Process individual investment ROI
async processInvestmentROI(investment) {
  const user = await User.findById(investment.userId);
  const wallet = await Wallet.findOne({ userId: investment.userId });

  if (!user) {
    throw new Error('User not found');
  }

  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const dailyRoi = parseFloat(investment.dailyRoiAmount);
  const totalPaid = parseFloat(investment.totalRoiPaid);
  const roiCap = parseFloat(investment.totalRoiCap);

  // Check if ROI cap reached
  if (totalPaid >= roiCap) {
    logger.info(`⚠️  Investment ${investment._id} reached ROI cap. Completing...`);
    investment.status = 'completed';
    investment.completedAt = new Date();
    await investment.save();
    return;
  }

  // Calculate actual ROI to pay (don't exceed cap)
  let roiToPay = dailyRoi;
  if (totalPaid + dailyRoi > roiCap) {
    roiToPay = roiCap - totalPaid;
    logger.info(`⚠️  Final ROI payment (capped): ₹${roiToPay}`);
  }

  // Save original balances for rollback
  const originalRoiBalance = parseFloat(wallet.roiBalance);
  const originalTotalEarnings = parseFloat(wallet.totalEarnings);

  try {
    // Generate transaction ID
    const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create ROI transaction
    const transaction = await Transaction.create({
      userId: investment.userId,
      userCode: user.userCode,
      transactionId,
      type: 'roi_credit_daily',
      category: 'roi',
      walletType: 'roi',
      amount: roiToPay,
      fee: 0,
      netAmount: roiToPay,
      balanceBefore: originalRoiBalance,
      balanceAfter: originalRoiBalance + roiToPay,
      status: 'completed',
      description: `Daily ROI for investment #${investment._id.toString().slice(-6)}`,
      metadata: {
        investmentId: investment._id,
        packageId: investment.packageId,
        packageName: investment.packageName,
        roiRate: investment.roiRate,
        daysCompleted: investment.daysCompleted + 1,
      },
    });

    // Create income distribution record
    await IncomeDistribution.create({
      userId: investment.userId,
      sourceUserId: investment.userId,
      incomeType: 'roi',
      amount: roiToPay,
      investmentId: investment._id,
      transactionId: transaction.transactionId,
      status: 'paid',
      paidAt: new Date(),
      metadata: {
        notes: `Daily ROI - Day ${investment.daysCompleted + 1}`,
      },
    });

    // Update wallet - CRITICAL FIX
    wallet.roiBalance = originalRoiBalance + roiToPay;
    wallet.totalEarnings = originalTotalEarnings + roiToPay;
    await wallet.save();

    // Update investment
    investment.totalRoiPaid = totalPaid + roiToPay;
    investment.daysCompleted += 1;
    investment.nextRoiDate = this.getNextRoiDate(investment.roiFrequency);
    
    // Add to distribution history
    investment.roiDistributions.push({
      date: new Date(),
      amount: roiToPay,
      transactionId: transaction._id,
    });

    // Check if completed after this payment
    if (investment.totalRoiPaid >= investment.totalRoiCap) {
      investment.status = 'completed';
      investment.completedAt = new Date();
      logger.info(`🎉 Investment ${investment._id} completed! Total paid: ₹${investment.totalRoiPaid}`);
    }

    // Check maturity date
    if (new Date() >= investment.maturityDate) {
      investment.status = 'matured';
      investment.completedAt = new Date();
      logger.info(`🎉 Investment ${investment._id} matured!`);
    }

    await investment.save();

    logger.info(`✅ ROI paid: ₹${roiToPay} to ${user.userCode} (Investment: ${investment._id.toString().slice(-8)})`);
    logger.info(`   New balances - ROI: ₹${wallet.roiBalance}, Total Earnings: ₹${wallet.totalEarnings}`);

  } catch (error) {
    // Rollback on error
    wallet.roiBalance = originalRoiBalance;
    wallet.totalEarnings = originalTotalEarnings;
    await wallet.save();
    logger.error(`❌ Transaction failed, rolled back: ${error.message}`);
    throw error;
  }
}


  // Calculate next ROI date based on frequency
  getNextRoiDate(frequency) {
    const next = new Date();
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        next.setDate(next.getDate() + 1);
    }
    
    next.setHours(0, 0, 0, 0);
    return next;
  }

  // Setup cron job - runs daily at 00:01 AM
  startCronJob() {
    // Cron expression: '1 0 * * *' = Every day at 00:01 AM
    cron.schedule('1 0 * * *', async () => {
      logger.info('⏰ Cron job triggered: Daily ROI distribution');
      try {
        await this.distributeROI();
      } catch (error) {
        logger.error('❌ Cron job failed:', error);
      }
    });

    logger.info('✅ ROI Cron job scheduled: Daily at 00:01 AM');
  }

  // Manual trigger for testing
  async manualDistribute() {
    logger.info('🔧 Manual ROI distribution triggered');
    return await this.distributeROI();
  }
}

module.exports = new RoiService();
