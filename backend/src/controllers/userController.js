const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Investment = require('../models/Investment');
const logger = require('../utils/logger');

// ==================== GET PROFILE ====================

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('wallets.main wallets.income wallets.roi')
      .populate('referredBy', 'userCode fullName referralCode');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch profile',
      error: error.message,
    });
  }
};

// ==================== UPDATE PROFILE ====================

exports.updateProfile = async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      address,
    } = req.body;

    const updateData = {};

    if (firstName) updateData['fullName.firstName'] = firstName;
    if (middleName) updateData['fullName.middleName'] = middleName;
    if (lastName) updateData['fullName.lastName'] = lastName;
    if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
    if (gender) updateData.gender = gender;
    if (address) updateData.address = address;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    logger.info(`Profile updated: ${user.email}`);

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

// ==================== UPDATE BANK DETAILS ====================

exports.updateBankDetails = async (req, res) => {
  try {
    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      branch,
    } = req.body;

    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide all required bank details',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          'bankDetails.accountHolderName': accountHolderName,
          'bankDetails.accountNumber': accountNumber,
          'bankDetails.ifscCode': ifscCode,
          'bankDetails.bankName': bankName,
          'bankDetails.branch': branch,
          'bankDetails.isVerified': false, // Reset verification
        },
      },
      { new: true }
    );

    logger.info(`Bank details updated: ${user.email}`);

    res.status(200).json({
      status: 'success',
      message: 'Bank details updated successfully. Pending verification.',
      data: {
        bankDetails: user.bankDetails,
      },
    });
  } catch (error) {
    logger.error('Update bank details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update bank details',
      error: error.message,
    });
  }
};

// ==================== GET DASHBOARD ====================

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user with wallet data
    const user = await User.findById(userId).populate(
      'wallets.main wallets.income wallets.roi'
    );

    // Get wallet
    const wallet = await Wallet.findOne({ userId });

    // Get active investments
    const activeInvestments = await Investment.find({
      userId,
      status: 'active',
    }).populate('packageId', 'name type roiRate');

    // Get total team size (referrals)
    const directReferrals = await User.countDocuments({ referredBy: userId });

    // Calculate total earnings
    const totalEarnings =
      parseFloat(wallet?.totalEarnings || 0) +
      parseFloat(wallet?.totalReferralIncome || 0) +
      parseFloat(wallet?.totalLevelIncome || 0);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          userCode: user.userCode,
          fullName: `${user.fullName.firstName} ${user.fullName.lastName}`,
          email: user.email,
          mobile: user.mobile,
          referralCode: user.referralCode,
          kycStatus: user.kycStatus,
        },
        wallet: {
          mainBalance: wallet?.mainBalance || 0,
          roiBalance: wallet?.roiBalance || 0,
          referralBalance: wallet?.referralBalance || 0,
          levelBalance: wallet?.levelBalance || 0,
          totalInvested: wallet?.totalInvested || 0,
          totalEarnings: totalEarnings,
          totalWithdrawn: wallet?.totalWithdrawn || 0,
        },
        investments: {
          active: activeInvestments.length,
          totalInvested: activeInvestments.reduce(
            (sum, inv) => sum + parseFloat(inv.amount),
            0
          ),
        },
        team: {
          directReferrals: directReferrals,
          totalTeamSize: user.totalTeamSize || 0,
        },
      },
    });
  } catch (error) {
    logger.error('Get dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard data',
      error: error.message,
    });
  }
};

// ==================== GET REFERRALS ====================

exports.getReferrals = async (req, res) => {
  try {
    const referrals = await User.find({ referredBy: req.user.id })
      .select('userCode fullName email mobile createdAt kycStatus')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: {
        count: referrals.length,
        referrals,
      },
    });
  } catch (error) {
    logger.error('Get referrals error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch referrals',
      error: error.message,
    });
  }
};
