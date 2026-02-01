const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      required: true,
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    userCode: {
      type: String,
      required: true,
    },
    
    // Transaction Details
    type: {
      type: String,
      enum: [
        'deposit_bank',
        'deposit_upi',
        'deposit_manual',
        'withdraw_request',
        'withdraw_approved',
        'withdraw_rejected',
        'investment_debit',
        'investment_refund',
        'roi_credit_daily',
        'roi_credit_staking',
        'referral_income',
        'level_income',
        'binary_income',
        'transfer_in',
        'transfer_out',
        'admin_credit',
        'admin_debit',
        'penalty',
        'bonus',
      ],
      required: true,
    },
    
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()),
    },
    
    fee: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    netAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()),
    },
    
    // Wallet Tracking
    walletType: {
      type: String,
      enum: ['main', 'hold', 'roi', 'referral', 'level', 'binary', 'staking'],
      required: true,
    },
    
    balanceBefore: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()),
    },
    
    balanceAfter: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()),
    },
    
    // Status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'reversed', 'cancelled'],
      default: 'pending',
    },
    
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    approvedAt: Date,
    rejectionReason: String,
    
    // Payment Details
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', 'paytm', 'phonepe', 'manual'],
    },
    
    paymentDetails: {
      utrNumber: String,
      transactionHash: String,
      accountNumber: String,
      screenshotUrl: String,
    },
    
    // Metadata
    metadata: {
      packageId: mongoose.Schema.Types.ObjectId,
      investmentId: mongoose.Schema.Types.ObjectId,
      referenceId: String,
      sourceTransactionId: String,
      adminNote: String,
      ipAddress: String,
      userAgent: String,
    },
    
    // Security
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    
    transactionHash: String,
    
    // Timestamps
    processedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// ==================== INDEXES ====================
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 }, { unique: true });
transactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });

// ==================== PRE-SAVE MIDDLEWARE ====================
transactionSchema.pre('save', function (next) {
  if (!this.transactionId) {
    this.transactionId = `TXN-${uuidv4().substr(0, 8).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
