const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const User = require('../models/User');
const logger = require('../utils/logger');

// ==================== AUTHENTICATION ====================

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

// ==================== ROLE-BASED AUTHORIZATION ====================

// Role-based access control
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated',
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.email} (role: ${req.user.role}). Required: ${roles.join(' or ')}`);
      return res.status(403).json({
        status: 'error',
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

// ==================== CONVENIENCE SHORTCUTS ====================

// Admin only access (admin or super_admin)
exports.adminOnly = exports.restrictTo('admin', 'super_admin');

// Super admin only
exports.superAdminOnly = exports.restrictTo('super_admin');

// ==================== PERMISSION-BASED AUTHORIZATION ====================

// Permission-based access control
exports.hasPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated',
      });
    }

    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has required permissions
    const hasRequiredPermission = permissions.some(permission =>
      req.user.permissions && req.user.permissions.includes(permission)
    );

    if (!hasRequiredPermission) {
      logger.warn(`Permission denied for user ${req.user.email}: Required ${permissions.join(' or ')}`);
      
      return res.status(403).json({
        status: 'error',
        message: `Access denied. Required permission: ${permissions.join(' or ')}`,
      });
    }

    next();
  };
};

// ==================== SELF OR ADMIN ====================

// Self or admin (user can access own data, admin can access anyone's)
exports.selfOrAdmin = async (req, res, next) => {
  try {
    const requestedUserId = req.params.userId || req.params.id;

    // If no user ID in params, skip check
    if (!requestedUserId) {
      return next();
    }

    // Admin can access anyone's data
    if (['admin', 'super_admin'].includes(req.user.role)) {
      return next();
    }

    // User can access their own data
    if (req.user._id.toString() === requestedUserId) {
      return next();
    }

    logger.warn(`Unauthorized access attempt by ${req.user.email} to user ${requestedUserId}`);

    return res.status(403).json({
      status: 'error',
      message: 'Access denied. You can only access your own data.',
    });

  } catch (error) {
    logger.error('SelfOrAdmin middleware error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Authorization failed',
    });
  }
};

// ==================== ACCOUNT VERIFICATION ====================

// Verify user account is verified
exports.verifiedOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Not authenticated',
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      status: 'error',
      message: 'Please verify your email first',
    });
  }
  next();
};

// ==================== RATE LIMITING ====================

// Rate limiting helper (basic in-memory implementation)
exports.checkRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }
    
    const userRequests = requests.get(userId);
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      logger.warn(`Rate limit exceeded for user ${req.user.email}`);
      return res.status(429).json({
        status: 'error',
        message: 'Too many requests. Please try again later.',
      });
    }
    
    recentRequests.push(now);
    requests.set(userId, recentRequests);
    next();
  };
};

// ==================== OWNERSHIP VERIFICATION ====================

// Verify resource ownership (generic)
exports.verifyOwnership = (Model, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const userId = req.user._id;

      // Admin can access any resource
      if (['admin', 'super_admin'].includes(req.user.role)) {
        return next();
      }

      // Check if resource belongs to user
      const resource = await Model.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          status: 'error',
          message: 'Resource not found',
        });
      }

      if (resource.userId.toString() !== userId.toString()) {
        logger.warn(`Ownership verification failed for user ${req.user.email}`);
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You do not own this resource.',
        });
      }

      // Attach resource to request for further use
      req.resource = resource;
      next();

    } catch (error) {
      logger.error('Ownership verification error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Ownership verification failed',
      });
    }
  };
};

// ==================== CONDITIONAL MIDDLEWARE ====================

// Apply middleware only if condition is true
exports.conditionalMiddleware = (condition, middleware) => {
  return (req, res, next) => {
    if (condition(req)) {
      return middleware(req, res, next);
    }
    next();
  };
};
