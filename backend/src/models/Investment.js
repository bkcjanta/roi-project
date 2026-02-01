const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
      required: true,
    },
    
    // Investment Details
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()),
    },
    
    type: {
      type: String,
      enum: ['daily_roi', 'staking'],
      required: true,
    },
    
    // ROI Configuration
    roiRate: {
      type: Number,
      required: true,
    },
    
    roiCap: {
      type: Number,
      required: true,
    },
    
    duration: {
      type: Number,
      required: true,
    },
    
    roiFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily',
    },
    
    // ROI Tracking
    totalRoiPaid: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    totalRoiCap: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()),
    },
    
    dailyRoiAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()),
    },
    
    daysCompleted: {
      type: Number,
      default: 0,
    },
    
    nextRoiDate: {
      type: Date,
      required: true,
    },
    
    // 🔥 ROI IDEMPOTENCY - PREVENTS DUPLICATE PAYOUTS
    roiDistributions: [
      {
        date: {
          type: Date,
          required: true,
        },
        amount: {
          type: mongoose.Schema.Types.Decimal128,
          required: true,
          get: (v) => parseFloat(v.toString()),
        },
        transactionId: {
          type: String,
          required: true,
        },
        distributedAt: {
          type: Date,
          default: Date.now,
        },
        jobId: String, // Cron job identifier
      },
    ],
    
    // Staking Specific
    lockPeriod: Number,
    unlockDate: Date,
    earlyWithdrawalPenalty: Number,
    
    // Status
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'expired'],
      default: 'active',
    },
    
    // Dates
    startDate: {
      type: Date,
      default: Date.now,
    },
    
    endDate: Date,
    completedAt: Date,
    
    // Transaction Reference
    transactionId: {
      type: String,
      required: true,
    },
    
    // Metadata
    metadata: {
      cancelledBy: mongoose.Schema.Types.ObjectId,
      cancellationReason: String,
      adminNote: String,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// ==================== INDEXES ====================
investmentSchema.index({ userId: 1, status: 1 });
investmentSchema.index({ nextRoiDate: 1, status: 1 }); // Critical for cron job
investmentSchema.index({ packageId: 1, status: 1 });
investmentSchema.index({ type: 1, status: 1 });
investmentSchema.index({ 'roiDistributions.date': 1, userId: 1 }); // For idempotency check

// ==================== METHODS ====================

// Check if ROI already distributed for a date
investmentSchema.methods.isRoiDistributedForDate = function (date) {
  const dateStr = new Date(date).toDateString();
  return this.roiDistributions.some(
    (dist) => new Date(dist.date).toDateString() === dateStr
  );
};

// Add ROI distribution record
investmentSchema.methods.addRoiDistribution = function (amount, transactionId, jobId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  this.roiDistributions.push({
    date: today,
    amount: amount,
    transactionId: transactionId,
    distributedAt: new Date(),
    jobId: jobId || 'manual',
  });
  
  return this.save();
};

module.exports = mongoose.model('Investment', investmentSchema);
