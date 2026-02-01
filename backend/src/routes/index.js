const express = require('express');
const router = express.Router();

// ==================== API INFO ====================

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'ROI Investment Platform API v1.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      wallets: '/api/wallets',
      investments: '/api/investments',
      withdrawals: '/api/withdrawals',
      packages: '/api/packages',
    },
    health: '/health',
  });
});

// ==================== TEST ROUTE ====================

router.get('/test', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API routes are working!',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
