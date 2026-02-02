const mongoose = require('mongoose');
const IncomeDistribution = require('../models/IncomeDistribution');


const incomeDistributionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    sourceUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    incomeType: {
      type: String,
      enum: ['referral', 'level', 'binary', 'matching', 'leadership', 'roi'],
      required: true,
    },
    
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v.toString()),
    },
    
    percentage: Number,
    
    level: Number,
    
    // Status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'paid'],
      default: 'pending',
    },
    
    paidAt: Date,
    
    // References
    investmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investment',
    },
    
    transactionId: String,
    
    // Metadata
    metadata: {
      notes: String,
      approvedBy: mongoose.Schema.Types.ObjectId,
      rejectionReason: String,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// ==================== INDEXES ====================
incomeDistributionSchema.index({ userId: 1, status: 1 });
incomeDistributionSchema.index({ sourceUserId: 1 });
incomeDistributionSchema.index({ incomeType: 1, status: 1 });

module.exports = mongoose.model('IncomeDistribution', incomeDistributionSchema);
