const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const logger = require('../utils/logger');
const referralTreeService = require('../services/referralTreeService');


// Helper: Generate access token
const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE,
  });
};


// Helper: Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, config.JWT_REFRESH_SECRET || config.JWT_SECRET, {
    expiresIn: '30d',
  });
};


// Helper: Generate unique user code
const generateUniqueUserCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    const userCount = await User.countDocuments();
    code = `USR${String(userCount + 1).padStart(6, '0')}`;
    const user = await User.findOne({ userCode: code });
    exists = !!user;
  }

  return code;
};


// Helper: Generate unique referral code
const generateUniqueReferralCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    code = `REF${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const user = await User.findOne({ referralCode: code });
    exists = !!user;
  }

  return code;
};


// ==================== REGISTER USER ====================
exports.register = async (req, res) => {
  // ✅ FORCE DISABLE transactions via environment variable
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
    const { 
      email, 
      mobile, 
      password, 
      firstName, 
      middleName,
      lastName, 
      sponsorCode,
      dateOfBirth,
      gender,
    } = req.body;

    // Validate required fields
    if (!email || !mobile || !password || !firstName || !lastName) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: 'Please provide all required fields',
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ 
      $or: [{ email }, { mobile }] 
    });

    if (existingUser) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: existingUser.email === email 
          ? 'Email already registered' 
          : 'Mobile already registered',
      });
    }

    // Validate sponsor code if provided
    if (sponsorCode) {
      const sponsor = await User.findOne({ 
        userCode: sponsorCode.toUpperCase() 
      });

      if (!sponsor) {
        if (session) await session.abortTransaction();
        return res.status(400).json({
          status: 'error',
          message: 'Invalid sponsor code',
        });
      }
    }

    // Generate unique codes
    const userCode = await generateUniqueUserCode();
    const referralCode = await generateUniqueReferralCode();

    // Create user
    const user = new User({
      userCode,
      referralCode,
      email,
      mobile,
      password,
      fullName: { 
        firstName, 
        middleName: middleName || '', 
        lastName 
      },
      dateOfBirth,
      gender,
      registrationIp: req.ip,
      registrationDevice: req.get('user-agent'),
    });

    // ✅ Build referral & binary tree (without session for now)
    let treeData = { uplineChain: [], binaryPlacement: null, isRoot: true };
    
    if (sponsorCode) {
      try {
        treeData = await referralTreeService.buildTreeOnRegistration(
          user,
          sponsorCode,
          null // Pass null instead of session for local testing
        );

        logger.info(`✅ Tree built for ${user.userCode}:`, {
          uplineLevels: treeData.uplineChain.length,
          binaryPosition: treeData.binaryPlacement?.position,
        });
      } catch (treeError) {
        if (session) await session.abortTransaction();
        logger.error('Tree building failed:', treeError);
        return res.status(400).json({
          status: 'error',
          message: `Referral tree error: ${treeError.message}`,
        });
      }
    }

    // Save user
    await user.save();

    // Create wallet
    const wallet = await Wallet.create({
      userId: user._id,
      userCode: user.userCode,
    });

    // Link wallet to user
    user.wallets.main = wallet._id;
    user.wallets.income = wallet._id;
    user.wallets.roi = wallet._id;
    await user.save();

    // ✅ Commit transaction if using
    if (session) {
      await session.commitTransaction();
      logger.info('✅ Transaction committed');
    }

    // Generate tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`✅ User registered: ${user.email} (${user.userCode})`);

    res.status(201).json({
      status: 'success',
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          userCode: user.userCode,
          email: user.email,
          mobile: user.mobile,
          fullName: `${firstName} ${middleName || ''} ${lastName}`.trim(),
          referralCode: user.referralCode,
          role: user.role,
          sponsor: user.sponsorCode || null,
          uplineLevels: treeData.uplineChain.length,
          binaryPosition: treeData.binaryPlacement?.position || null,
        },
        token,
        refreshToken,
      },
    });

  } catch (error) {
    if (session) await session.abortTransaction();
    logger.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed',
      error: error.message,
    });
  } finally {
    if (session) session.endSession();
  }
};


// ==================== LOGIN USER ====================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password',
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
      });
    }

    if (user.isLocked()) {
      return res.status(423).json({
        status: 'error',
        message: 'Account locked due to multiple failed attempts. Try again later.',
      });
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: `Account is ${user.accountStatus}`,
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
      });
    }

    await user.resetLoginAttempts();

    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      lastLoginIp: req.ip,
    });

    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`✅ User logged in: ${user.email}`);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          userCode: user.userCode,
          email: user.email,
          mobile: user.mobile,
          fullName: user.fullNameString,
          referralCode: user.referralCode,
          role: user.role,
          kycStatus: user.kycStatus,
          teamCount: user.teamCount,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Login failed',
      error: error.message,
    });
  }
};


// ==================== GET CURRENT USER ====================
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('wallets.main wallets.income wallets.roi')
      .populate('sponsorId', 'userCode fullName')
      .populate('binaryParentId', 'userCode fullName');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { 
        user,
        referralInfo: {
          uplineChain: user.uplineChain,
          teamCount: user.teamCount,
          binaryTeam: user.binaryTeam,
        },
      },
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user data',
      error: error.message,
    });
  }
};


// ==================== LOGOUT ====================
exports.logout = async (req, res) => {
  try {
    logger.info(`User logged out: ${req.user.id}`);

    res.status(200).json({
      status: 'success',
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Logout failed',
    });
  }
};


// ==================== REFRESH TOKEN ====================
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token required',
      });
    }

    const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET || config.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    const newToken = generateToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    res.status(200).json({
      status: 'success',
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Invalid refresh token',
    });
  }
};


// ==================== CHANGE PASSWORD ====================
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide both passwords',
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    const isValid = await user.comparePassword(currentPassword);

    if (!isValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password incorrect',
      });
    }

    user.password = newPassword;
    await user.save();

    logger.info(`Password changed: ${user.email}`);

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to change password',
      error: error.message,
    });
  }
};
