const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const walletRoutes = require('./wallet.routes');

// ==================== API INFO ====================

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'ROI Investment Platform API v1.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      wallets: '/api/wallets',
    },
    health: '/health',
  });
});

// ==================== MOUNT ROUTES ====================

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/wallets', walletRoutes);

// ==================== TEST ROUTE ====================

router.get('/test', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API routes are working!',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
