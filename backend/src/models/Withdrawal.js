const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const withdrawalSchema = new mongoose.Schema(
  {
    withdrawalId: {
      type: String,
      unique: true,
      // ✅ REMOVE required: true (will be generated in pre-save)
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    userCode: {
      type: String,
      required: true,
    },
    
    // Amount Details
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

    // Wallet Info
    walletType: {
      type: String,
      enum: ['roi', 'referral', 'level', 'binary', 'main'],
      default: 'roi',
    },

    balanceBefore: {
      type: mongoose.Schema.Types.Decimal128,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    
    // Bank Details Snapshot
    bankDetails: {
      accountNumber: {
        type: String,
        required: true,
      },
      ifscCode: {
        type: String,
        required: true,
        uppercase: true,
      },
      accountHolderName: {
        type: String,
        required: true,
      },
      bankName: {
        type: String,
        required: true,
      },
      branchName: String,
    },
    
    // Status
    status: {
      type: String,
      enum: [
        'pending',
        'under_review',
        'approved',
        'processing',
        'completed',
        'rejected',
        'cancelled',
      ],
      default: 'pending',
    },
    
    // Admin Actions
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    reviewedAt: Date,
    
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    approvedAt: Date,
    rejectionReason: String,
    adminNote: String,
    
    // Payment Processing
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', 'manual'],
      default: 'bank_transfer',
    },

    utrNumber: String,
    paymentProofUrl: String,
    processedAt: Date,
    
    // Transaction Reference
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },

    // Metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
    },
    
    // Timestamps
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    
    completedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// ==================== INDEXES ====================
withdrawalSchema.index({ userId: 1, requestedAt: -1 });
withdrawalSchema.index({ status: 1, requestedAt: -1 });
withdrawalSchema.index({ withdrawalId: 1 }, { unique: true, sparse: true });
withdrawalSchema.index({ userCode: 1 });

// ==================== PRE-SAVE MIDDLEWARE ====================
withdrawalSchema.pre('save', async function (next) {
  // Generate withdrawalId if not present
  if (!this.withdrawalId) {
    this.withdrawalId = `WDL-${uuidv4().substr(0, 8).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
