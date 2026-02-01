const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const User = require('../models/User');
const logger = require('../utils/logger');

// Protect routes - JWT verification
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from header
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized. Please login.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Check account status
    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: 'Account is not active',
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expired',
      });
    }

    res.status(401).json({
      status: 'error',
      message: 'Not authorized',
    });
  }
};

// Role-based access control
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Permission denied',
      });
    }
    next();
  };
};
