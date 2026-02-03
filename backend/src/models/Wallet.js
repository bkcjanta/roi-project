const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    
    // ✅ ADD THIS
    userCode: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    
    // Wallet Balances
    mainBalance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    holdBalance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    roiBalance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    referralBalance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    levelBalance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    binaryBalance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    stakingBalance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    // Lifetime Totals
    totalDeposited: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    totalInvested: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    totalEarnings: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    totalWithdrawn: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    totalReferralIncome: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    totalLevelIncome: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    totalBinaryIncome: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    // Pending Operations
    pendingDeposit: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    pendingWithdrawal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    // Wallet Status
    isLocked: {
      type: Boolean,
      default: false,
    },
    
    lockedReason: String,
    
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    lockedAt: Date,
    
    // Currency
    currency: {
      type: String,
      default: 'INR',
    },
    
    // Metadata
    lastTransactionAt: Date,
    
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// ==================== INDEXES ====================
walletSchema.index({ userId: 1 }, { unique: true });
walletSchema.index({ userCode: 1 });  // ✅ ADD INDEX
walletSchema.index({ isLocked: 1 });

module.exports = mongoose.model('Wallet', walletSchema);
