const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const walletRoutes = require('./wallet.routes');
const packageRoutes = require('./package.routes');
const investmentRoutes = require('./investment.routes');
const roiRoutes = require('./roi.routes'); // ✅ ADD THIS
const transactionRoutes = require('./transaction.routes');

// API info
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'ROI Investment Platform API v1.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      wallets: '/api/wallets',
      packages: '/api/packages',
      investments: '/api/investments',
      
      roi: '/api/roi', // ✅ ADD THIS
      transactions: '/api/transactions',
    },
    health: '/health',
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/wallets', walletRoutes);
router.use('/packages', packageRoutes);
router.use('/investments', investmentRoutes);
router.use('/roi', roiRoutes); // ✅ ADD THIS
router.use('/transactions', transactionRoutes);

module.exports = router;
