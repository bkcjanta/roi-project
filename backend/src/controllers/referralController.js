const referralTreeService = require('../services/referralTreeService');
const levelIncomeService = require('../services/levelIncomeService');
const binaryIncomeService = require('../services/binaryIncomeService');
const User = require('../models/User');
const logger = require('../utils/logger');

// ==================== GET MY REFERRAL TREE ====================
exports.getMyReferralTree = async (req, res) => {
  try {
    const userId = req.user.id;

    const treeData = await referralTreeService.getUserReferralTree(userId);

    res.status(200).json({
      status: 'success',
      data: treeData,
    });
  } catch (error) {
    logger.error('Get referral tree error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch referral tree',
      error: error.message,
    });
  }
};

// ==================== GET MY BINARY TREE ====================
exports.getMyBinaryTree = async (req, res) => {
  try {
    const userId = req.user.id;

    const treeData = await referralTreeService.getUserBinaryTree(userId);

    res.status(200).json({
      status: 'success',
      data: treeData,
    });
  } catch (error) {
    logger.error('Get binary tree error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch binary tree',
      error: error.message,
    });
  }
};

// ==================== GET TEAM BY LEVEL ====================
exports.getTeamByLevel = async (req, res) => {
  try {
    const userId = req.user.id;
    const { level = 1 } = req.query;

    const team = await referralTreeService.getTeamByLevel(userId, parseInt(level));

    res.status(200).json({
      status: 'success',
      data: {
        level: parseInt(level),
        count: team.length,
        members: team,
      },
    });
  } catch (error) {
    logger.error('Get team by level error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch team',
      error: error.message,
    });
  }
};

// ==================== GET DIRECT REFERRALS ====================
exports.getDirectReferrals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const referrals = await User.find({ sponsorId: userId })
      .select('userCode fullName email mobile createdAt accountStatus teamCount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments({ sponsorId: userId });

    res.status(200).json({
      status: 'success',
      data: {
        referrals,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Get direct referrals error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch direct referrals',
      error: error.message,
    });
  }
};

// ==================== GET REFERRAL STATS ====================
exports.getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .select('userCode referralCode teamCount')
      .populate('sponsorId', 'userCode fullName');

    // Get level income summary
    const levelIncomeSummary = await levelIncomeService.getLevelIncomeSummary(userId);

    // Get binary summary
    const binarySummary = await binaryIncomeService.getBinarySummary(userId);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          userCode: user.userCode,
          referralCode: user.referralCode,
          sponsor: user.sponsorId,
        },
        team: user.teamCount,
        levelIncome: levelIncomeSummary,
        binaryIncome: binarySummary,
      },
    });
  } catch (error) {
    logger.error('Get referral stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch referral stats',
      error: error.message,
    });
  }
};

// ==================== VERIFY SPONSOR CODE ====================
exports.verifySponsorCode = async (req, res) => {
  try {
    const { sponsorCode } = req.body;

    if (!sponsorCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Sponsor code is required',
      });
    }

    const sponsor = await User.findOne({ userCode: sponsorCode.toUpperCase() })
      .select('userCode fullName email accountStatus');

    if (!sponsor) {
      return res.status(404).json({
        status: 'error',
        message: 'Invalid sponsor code',
        valid: false,
      });
    }

    if (sponsor.accountStatus !== 'active') {
      return res.status(400).json({
        status: 'error',
        message: 'Sponsor account is not active',
        valid: false,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Valid sponsor code',
      valid: true,
      data: {
        sponsor: {
          userCode: sponsor.userCode,
          fullName: `${sponsor.fullName.firstName} ${sponsor.fullName.lastName}`,
        },
      },
    });
  } catch (error) {
    logger.error('Verify sponsor code error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify sponsor code',
      error: error.message,
    });
  }
};
