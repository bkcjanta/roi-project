const User = require('../models/User');
const Wallet = require('../models/Wallet');
const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const logger = require('../utils/logger');

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

// Register new user
exports.register = async (req, res) => {
  try {
    const { email, mobile, password, firstName, lastName, referredByCode } = req.body;

    // Validate required fields
    if (!email || !mobile || !password || !firstName || !lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide all required fields',
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: existingUser.email === email ? 'Email already registered' : 'Mobile already registered',
      });
    }

    // Validate referral code
    let referredByUser = null;
    if (referredByCode) {
      referredByUser = await User.findOne({ referralCode: referredByCode });
      if (!referredByUser) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid referral code',
        });
      }
    }

    // Generate unique codes
    const userCount = await User.countDocuments();
    const userCode = `USR${String(userCount + 1).padStart(6, '0')}`;
    const referralCode = `REF${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    // Create user
    const user = await User.create({
      userCode,
      referralCode,
      email,
      mobile,
      password,
      fullName: { firstName, lastName },
      referredBy: referredByUser?._id,
      sponsorCode: referredByCode,
      registrationIp: req.ip,
      registrationDevice: req.get('user-agent'),
    });

    // Create wallet
    const wallet = await Wallet.create({ userId: user._id });

    // Link wallet to user
    await User.findByIdAndUpdate(user._id, {
      'wallets.main': wallet._id,
      'wallets.income': wallet._id,
      'wallets.roi': wallet._id,
    });

    // Update referrer stats
    if (referredByUser) {
      await User.findByIdAndUpdate(referredByUser._id, {
        $inc: { totalDirectReferrals: 1 },
      });
    }

    // Generate tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`User registered: ${user.email}`);

    res.status(201).json({
      status: 'success',
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          userCode: user.userCode,
          email: user.email,
          mobile: user.mobile,
          fullName: `${firstName} ${lastName}`,
          referralCode: user.referralCode,
          role: user.role,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed',
      error: error.message,
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password',
      });
    }

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
      });
    }

    // Check account lock
    if (user.isLocked()) {
      return res.status(423).json({
        status: 'error',
        message: 'Account locked due to multiple failed attempts',
      });
    }

    // Check account status
    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: `Account is ${user.accountStatus}`,
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
      });
    }

    // Reset login attempts
    await user.resetLoginAttempts();

    // Update login info
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      lastLoginIp: req.ip,
    });

    // Generate tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`User logged in: ${user.email}`);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          userCode: user.userCode,
          email: user.email,
          mobile: user.mobile,
          fullName: `${user.fullName.firstName} ${user.fullName.lastName}`,
          referralCode: user.referralCode,
          role: user.role,
          kycStatus: user.kycStatus,
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

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('wallets.main wallets.income wallets.roi');

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
    logger.error('Get current user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user data',
      error: error.message,
    });
  }
};

// Logout user
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

// Refresh token
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

// Change password
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
