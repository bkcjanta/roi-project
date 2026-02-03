const mongoose = require('mongoose');
const Withdrawal = require('../models/Withdrawal');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const SettingsHelper = require('../utils/settingsHelper');
const logger = require('../utils/logger');

// ==================== USER FUNCTIONS ====================

// Request withdrawal
// Request withdrawal
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, walletType = 'roi', bankDetails } = req.body;
    const userId = req.user.id;

    // ✅ FIXED: Default settings with proper fallback
    let withdrawalSettings = {
      enabled: true,
      minAmount: 100,
      maxAmount: 100000,
      feePercentage: 5,
      dailyLimit: 3,
      processingTime: '24-48 hours'
    };

    let kycSettings = {
      requiredForWithdrawal: false,
      maxAmountWithoutKYC: 5000
    };

    // Try to load from database, but don't fail if not found
    try {
      const dbWithdrawalSettings = await SettingsHelper.getByPrefix('withdrawal');
      const dbKycSettings = await SettingsHelper.getByPrefix('kyc');
      
      // Only override if DB settings exist and are not empty
      if (dbWithdrawalSettings && Object.keys(dbWithdrawalSettings).length > 0) {
        withdrawalSettings = { ...withdrawalSettings, ...dbWithdrawalSettings };
      }
      
      if (dbKycSettings && Object.keys(dbKycSettings).length > 0) {
        kycSettings = { ...kycSettings, ...dbKycSettings };
      }
    } catch (settingsError) {
      logger.warn('⚠️ Settings not found, using defaults');
    }

    // Validation
    if (!amount || !bankDetails) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide amount and bank details',
      });
    }

    // Validate amount
    const minAmount = withdrawalSettings.minAmount || 100;
    const maxAmount = withdrawalSettings.maxAmount || 100000;
    
    if (amount < minAmount) {
      return res.status(400).json({
        status: 'error',
        message: `Minimum withdrawal amount is ₹${minAmount}`,
      });
    }

    if (amount > maxAmount) {
      return res.status(400).json({
        status: 'error',
        message: `Maximum withdrawal amount is ₹${maxAmount}`,
      });
    }

    // Validate bank details
    const requiredFields = ['accountNumber', 'ifscCode', 'accountHolderName', 'bankName'];
    for (const field of requiredFields) {
      if (!bankDetails[field]) {
        return res.status(400).json({
          status: 'error',
          message: `Bank detail '${field}' is required`,
        });
      }
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

    // Check KYC if required
    if (kycSettings.requiredForWithdrawal && user.kycStatus !== 'approved') {
      const maxWithoutKyc = kycSettings.maxAmountWithoutKYC || 5000;
      if (amount > maxWithoutKyc) {
        return res.status(403).json({
          status: 'error',
          message: `KYC verification required for withdrawals above ₹${maxWithoutKyc}`,
        });
      }
    }

    // Check daily limit
    const dailyLimit = withdrawalSettings.dailyLimit || 3;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayWithdrawals = await Withdrawal.countDocuments({
      userId,
      requestedAt: { $gte: today },
      status: { $nin: ['rejected', 'cancelled'] },
    });

    if (todayWithdrawals >= dailyLimit) {
      return res.status(400).json({
        status: 'error',
        message: `Daily withdrawal limit (${dailyLimit}) reached`,
      });
    }

    // Get balance based on wallet type
    let balance = 0;
    switch (walletType) {
      case 'roi':
        balance = parseFloat(wallet.roiBalance || 0);
        break;
      case 'referral':
        balance = parseFloat(wallet.referralBalance || 0);
        break;
      case 'level':
        balance = parseFloat(wallet.levelBalance || 0);
        break;
      case 'binary':
        balance = parseFloat(wallet.binaryBalance || 0);
        break;
      case 'main':
        balance = parseFloat(wallet.mainBalance || 0);
        break;
      default:
        balance = parseFloat(wallet.roiBalance || 0);
    }

    // Calculate fee and net amount
    const feePercentage = withdrawalSettings.feePercentage || 5;
    const fee = (amount * feePercentage) / 100;
    const netAmount = amount - fee;

    // Check sufficient balance
    if (balance < amount) {
      return res.status(400).json({
        status: 'error',
        message: `Insufficient ${walletType} balance. Available: ₹${balance.toFixed(2)}`,
      });
    }

    // Save original balance for rollback
    const originalBalance = balance;
    const originalHoldBalance = parseFloat(wallet.holdBalance || 0);
    const originalPendingWithdrawal = parseFloat(wallet.pendingWithdrawal || 0);

    try {
      // Create withdrawal request
      const withdrawal = await Withdrawal.create({
        userId,
        userCode: user.userCode,
        amount,
        fee,
        netAmount,
        walletType,
        balanceBefore: originalBalance,
        bankDetails: {
          accountNumber: bankDetails.accountNumber,
          ifscCode: bankDetails.ifscCode.toUpperCase(),
          accountHolderName: bankDetails.accountHolderName,
          bankName: bankDetails.bankName,
          branchName: bankDetails.branchName || '',
        },
        status: 'pending',
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });

      // Create pending transaction
      const transaction = await Transaction.create({
        userId,
        userCode: user.userCode,
        transactionId: `WTH${Date.now()}${Math.floor(Math.random() * 1000)}`,
        type: 'withdraw_request',
        amount: -amount,
        fee,
        netAmount: -netAmount,
        walletType,
        balanceBefore: originalBalance,
        balanceAfter: originalBalance - amount,
        status: 'pending',
        metadata: {
          withdrawalId: withdrawal._id,
        },
      });

      // Link transaction to withdrawal
      withdrawal.transactionId = transaction._id;
      await withdrawal.save();

      // Deduct from wallet (hold in pending)
      switch (walletType) {
        case 'roi':
          wallet.roiBalance -= amount;
          break;
        case 'referral':
          wallet.referralBalance -= amount;
          break;
        case 'level':
          wallet.levelBalance -= amount;
          break;
        case 'binary':
          wallet.binaryBalance -= amount;
          break;
        case 'main':
          wallet.mainBalance -= amount;
          break;
      }

      wallet.holdBalance = originalHoldBalance + amount;
      wallet.pendingWithdrawal = originalPendingWithdrawal + amount;
      await wallet.save();

      const processingTime = withdrawalSettings.processingTime || '24-48 hours';
      
      logger.info(`✅ Withdrawal requested: User ${user.userCode}, Amount ₹${amount}, Fee ${feePercentage}%, ID ${withdrawal.withdrawalId}`);

      res.status(201).json({
        status: 'success',
        message: `Withdrawal request submitted successfully. Processing time: ${processingTime}`,
        data: {
          withdrawal: {
            withdrawalId: withdrawal.withdrawalId,
            amount: withdrawal.amount,
            fee: withdrawal.fee,
            netAmount: withdrawal.netAmount,
            walletType: withdrawal.walletType,
            status: withdrawal.status,
            requestedAt: withdrawal.requestedAt,
            estimatedProcessingTime: processingTime,
          },
        },
      });
    } catch (innerError) {
      logger.error('❌ Withdrawal request failed, rolling back:', innerError.message);
      
      // Rollback wallet if needed
      if (wallet) {
        switch (walletType) {
          case 'roi':
            wallet.roiBalance = originalBalance;
            break;
          case 'referral':
            wallet.referralBalance = originalBalance;
            break;
          case 'level':
            wallet.levelBalance = originalBalance;
            break;
          case 'binary':
            wallet.binaryBalance = originalBalance;
            break;
          case 'main':
            wallet.mainBalance = originalBalance;
            break;
        }
        wallet.holdBalance = originalHoldBalance;
        wallet.pendingWithdrawal = originalPendingWithdrawal;
        await wallet.save();
      }

      throw innerError;
    }
  } catch (error) {
    logger.error('Request withdrawal error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to request withdrawal',
      error: error.message,
    });
  }
};


// Get user's withdrawals
exports.getMyWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { userId };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const withdrawals = await Withdrawal.find(filter)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Withdrawal.countDocuments(filter);

    const stats = await Withdrawal.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } },
        },
      },
    ]);

    res.json({
      status: 'success',
      data: {
        withdrawals,
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
    logger.error('Get withdrawals error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch withdrawals',
      error: error.message,
    });
  }
};

// Get single withdrawal
exports.getWithdrawalById = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOne({
      _id: req.params.id,
      userId: req.user.id,
    })
      .populate('reviewedBy', 'fullName email')
      .populate('approvedBy', 'fullName email');

    if (!withdrawal) {
      return res.status(404).json({
        status: 'error',
        message: 'Withdrawal not found',
      });
    }

    res.json({
      status: 'success',
      data: { withdrawal },
    });
  } catch (error) {
    logger.error('Get withdrawal error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch withdrawal',
      error: error.message,
    });
  }
};

// Cancel withdrawal
exports.cancelWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!withdrawal) {
      return res.status(404).json({
        status: 'error',
        message: 'Withdrawal not found',
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot cancel withdrawal with status: ${withdrawal.status}`,
      });
    }

    const wallet = await Wallet.findOne({ userId: req.user.id });
    const amount = parseFloat(withdrawal.amount);
    
    switch (withdrawal.walletType) {
      case 'roi':
        wallet.roiBalance += amount;
        break;
      case 'referral':
        wallet.referralBalance += amount;
        break;
      case 'level':
        wallet.levelBalance += amount;
        break;
      case 'binary':
        wallet.binaryBalance += amount;
        break;
      case 'main':
        wallet.mainBalance += amount;
        break;
    }

    wallet.holdBalance -= amount;
    wallet.pendingWithdrawal -= amount;
    await wallet.save();

    withdrawal.status = 'cancelled';
    await withdrawal.save();

    if (withdrawal.transactionId) {
      await Transaction.findByIdAndUpdate(withdrawal.transactionId, {
        status: 'cancelled',
      });
    }

    logger.info(`✅ Withdrawal cancelled: ${withdrawal.withdrawalId}`);

    res.json({
      status: 'success',
      message: 'Withdrawal cancelled successfully',
      data: { withdrawal },
    });
  } catch (error) {
    logger.error('Cancel withdrawal error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel withdrawal',
      error: error.message,
    });
  }
};

// ==================== ADMIN FUNCTIONS ====================

// Get all withdrawals (Admin)
exports.getAllWithdrawals = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, userId, userCode } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    if (userCode) filter.userCode = userCode;

    const skip = (page - 1) * limit;

    const withdrawals = await Withdrawal.find(filter)
      .populate('userId', 'fullName email userCode')
      .populate('reviewedBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Withdrawal.countDocuments(filter);

    const stats = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } },
        },
      },
    ]);

    res.json({
      status: 'success',
      data: {
        withdrawals,
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
    logger.error('Get all withdrawals error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch withdrawals',
      error: error.message,
    });
  }
};

// ⭐ NEW: Get withdrawal statistics (Admin)
// ⭐ IMPROVED: Get withdrawal statistics (Admin)
exports.getWithdrawalStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await Withdrawal.aggregate([
      {
        $facet: {
          // Pending withdrawals
          pending: [
            { $match: { status: 'pending' } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalAmount: { $sum: { $toDouble: '$amount' } },
              },
            },
          ],
          // Today's approved
          todayApproved: [
            {
              $match: {
                status: 'approved',
                approvedAt: { $gte: today },
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalAmount: { $sum: { $toDouble: '$amount' } },
              },
            },
          ],
          // Today's completed
          todayCompleted: [
            {
              $match: {
                status: 'completed',
                completedAt: { $gte: today },
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalAmount: { $sum: { $toDouble: '$amount' } },
              },
            },
          ],
          // Today's rejected
          todayRejected: [
            {
              $match: {
                status: 'rejected',
                reviewedAt: { $gte: today },
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
              },
            },
          ],
          // All time totals
          allTime: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: { $toDouble: '$amount' } },
              },
            },
          ],
        },
      },
    ]);

    // ✅ CLEANED RESPONSE (Remove _id: null)
    const cleanedData = {
      pending: stats[0].pending[0] 
        ? { count: stats[0].pending[0].count, totalAmount: stats[0].pending[0].totalAmount }
        : { count: 0, totalAmount: 0 },
      
      todayApproved: stats[0].todayApproved[0]
        ? { count: stats[0].todayApproved[0].count, totalAmount: stats[0].todayApproved[0].totalAmount }
        : { count: 0, totalAmount: 0 },
      
      todayCompleted: stats[0].todayCompleted[0]
        ? { count: stats[0].todayCompleted[0].count, totalAmount: stats[0].todayCompleted[0].totalAmount }
        : { count: 0, totalAmount: 0 },
      
      todayRejected: stats[0].todayRejected[0]
        ? { count: stats[0].todayRejected[0].count }
        : { count: 0 },
      
      allTime: stats[0].allTime,
    };

    res.json({
      status: 'success',
      data: cleanedData,
    });
  } catch (error) {
    logger.error('Get withdrawal stats error:', error);
    res.json({
      status: 'error',
      message: 'Failed to fetch withdrawal statistics',
      error: error.message,
    });
  }
};


// Approve withdrawal (Admin)
exports.approveWithdrawal = async (req, res) => {
  try {
    const { adminNote } = req.body;
    const withdrawalId = req.params.id;
    const adminId = req.user.id;

    const withdrawal = await Withdrawal.findById(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({
        status: 'error',
        message: 'Withdrawal not found',
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot approve withdrawal with status: ${withdrawal.status}`,
      });
    }

    withdrawal.status = 'approved';
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();
    if (adminNote) withdrawal.adminNote = adminNote;
    await withdrawal.save();

    if (withdrawal.transactionId) {
      await Transaction.findByIdAndUpdate(withdrawal.transactionId, {
        status: 'approved',
        approvedBy: adminId,
        approvedAt: new Date(),
      });
    }

    logger.info(`✅ Withdrawal approved: ${withdrawal.withdrawalId} by admin ${req.user.email}`);

    res.json({
      status: 'success',
      message: 'Withdrawal approved successfully',
      data: { withdrawal },
    });
  } catch (error) {
    logger.error('Approve withdrawal error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to approve withdrawal',
      error: error.message,
    });
  }
};

// Reject withdrawal (Admin)
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const withdrawalId = req.params.id;
    const adminId = req.user.id;

    if (!rejectionReason) {
      return res.status(400).json({
        status: 'error',
        message: 'Rejection reason is required',
      });
    }

    const withdrawal = await Withdrawal.findById(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({
        status: 'error',
        message: 'Withdrawal not found',
      });
    }

    if (!['pending', 'approved'].includes(withdrawal.status)) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot reject withdrawal with status: ${withdrawal.status}`,
      });
    }

    const wallet = await Wallet.findOne({ userId: withdrawal.userId });
    const amount = parseFloat(withdrawal.amount);

    // Restore balance
    switch (withdrawal.walletType) {
      case 'roi':
        wallet.roiBalance += amount;
        break;
      case 'referral':
        wallet.referralBalance += amount;
        break;
      case 'level':
        wallet.levelBalance += amount;
        break;
      case 'binary':
        wallet.binaryBalance += amount;
        break;
      case 'main':
        wallet.mainBalance += amount;
        break;
    }

    wallet.holdBalance -= amount;
    wallet.pendingWithdrawal -= amount;
    await wallet.save();

    withdrawal.status = 'rejected';
    withdrawal.reviewedBy = adminId;
    withdrawal.reviewedAt = new Date();
    withdrawal.rejectionReason = rejectionReason;
    await withdrawal.save();

    if (withdrawal.transactionId) {
      await Transaction.findByIdAndUpdate(withdrawal.transactionId, {
        status: 'rejected',
        rejectionReason,
      });
    }

    logger.info(`✅ Withdrawal rejected: ${withdrawal.withdrawalId} by admin ${req.user.email}`);

    res.json({
      status: 'success',
      message: 'Withdrawal rejected and balance restored',
      data: { withdrawal },
    });
  } catch (error) {
    logger.error('Reject withdrawal error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reject withdrawal',
      error: error.message,
    });
  }
};

// Complete withdrawal (Admin - Mark as paid)
exports.completeWithdrawal = async (req, res) => {
  try {
    const { utrNumber, paymentProofUrl, adminNote } = req.body;
    const withdrawalId = req.params.id;
    const adminId = req.user.id;

    if (!utrNumber) {
      return res.status(400).json({
        status: 'error',
        message: 'UTR number is required',
      });
    }

    const withdrawal = await Withdrawal.findById(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({
        status: 'error',
        message: 'Withdrawal not found',
      });
    }

    if (withdrawal.status !== 'approved') {
      return res.status(400).json({
        status: 'error',
        message: `Can only complete approved withdrawals. Current status: ${withdrawal.status}`,
      });
    }

    const wallet = await Wallet.findOne({ userId: withdrawal.userId });
    const amount = parseFloat(withdrawal.amount);

    // Move from hold to withdrawn
    wallet.holdBalance -= amount;
    wallet.pendingWithdrawal -= amount;
    wallet.totalWithdrawn = parseFloat(wallet.totalWithdrawn || 0) + amount;
    await wallet.save();

    withdrawal.status = 'completed';
    withdrawal.utrNumber = utrNumber;
    if (paymentProofUrl) withdrawal.paymentProofUrl = paymentProofUrl;
    if (adminNote) withdrawal.adminNote = adminNote;
    withdrawal.processedAt = new Date();
    withdrawal.completedAt = new Date();
    await withdrawal.save();

    if (withdrawal.transactionId) {
      await Transaction.findByIdAndUpdate(withdrawal.transactionId, {
        status: 'completed',
        completedAt: new Date(),
        'paymentDetails.utrNumber': utrNumber,
      });
    }

    logger.info(`✅ Withdrawal completed: ${withdrawal.withdrawalId}, UTR: ${utrNumber} by admin ${req.user.email}`);

    res.json({
      status: 'success',
      message: 'Withdrawal marked as completed',
      data: { withdrawal },
    });
  } catch (error) {
    logger.error('Complete withdrawal error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to complete withdrawal',
      error: error.message,
    });
  }
};
