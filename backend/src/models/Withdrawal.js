const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const withdrawalSchema = new mongoose.Schema(
  {
    withdrawalId: {
      type: String,
      unique: true,
      required: true,
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    
    // Bank Details Snapshot
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      bankName: String,
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
    utrNumber: String,
    paymentProofUrl: String,
    processedAt: Date,
    
    // Transaction Reference
    transactionId: String,
    
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
withdrawalSchema.index({ withdrawalId: 1 }, { unique: true });

// ==================== PRE-SAVE MIDDLEWARE ====================
withdrawalSchema.pre('save', function (next) {
  if (!this.withdrawalId) {
    this.withdrawalId = `WD-${uuidv4().substr(0, 8).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
