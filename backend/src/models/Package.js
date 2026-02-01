const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema(
  {
    packageCode: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
    },
    
    name: {
      type: String,
      required: true,
    },
    
    description: String,
    
    type: {
      type: String,
      enum: ['daily_roi', 'staking'],
      required: true,
    },
    
    // Investment Limits
    minAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()),
    },
    
    maxAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()),
    },
    
    incrementStep: {
      type: mongoose.Schema.Types.Decimal128,
      default: 1000,
      get: (v) => parseFloat(v.toString()),
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
    
    // Staking Specific
    lockPeriod: Number,
    earlyWithdrawalPenalty: Number,
    
    // Income Eligibility
    enablesReferralIncome: {
      type: Boolean,
      default: true,
    },
    
    enablesLevelIncome: {
      type: Boolean,
      default: true,
    },
    
    enablesBinaryIncome: {
      type: Boolean,
      default: true,
    },
    
    minActiveReferralsRequired: {
      type: Number,
      default: 0,
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    
    isVisible: {
      type: Boolean,
      default: true,
    },
    
    availableSlots: Number,
    
    soldCount: {
      type: Number,
      default: 0,
    },
    
    // Features & Display
    features: [String],
    
    badge: String,
    
    displayOrder: {
      type: Number,
      default: 0,
    },
    
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// ==================== INDEXES ====================
packageSchema.index({ packageCode: 1 }, { unique: true });
packageSchema.index({ isActive: 1, isVisible: 1 });
packageSchema.index({ displayOrder: 1 });

module.exports = mongoose.model('Package', packageSchema);
