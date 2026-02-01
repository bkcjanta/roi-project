const mongoose = require('mongoose');

const binaryTreeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    
    // Tree Structure
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BinaryTree',
    },
    
    position: {
      type: String,
      enum: ['left', 'right'],
    },
    
    // Children
    leftChildId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BinaryTree',
    },
    
    rightChildId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BinaryTree',
    },
    
    // Statistics
    leftCount: {
      type: Number,
      default: 0,
    },
    
    rightCount: {
      type: Number,
      default: 0,
    },
    
    leftBusiness: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    rightBusiness: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    // Carry Forward
    leftCarryForward: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    rightCarryForward: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => parseFloat(v.toString()),
    },
    
    // Path
    path: String,
    
    level: {
      type: Number,
      default: 0,
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Metadata
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    
    lastCalculationAt: Date,
    
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
binaryTreeSchema.index({ userId: 1 }, { unique: true });
binaryTreeSchema.index({ parentId: 1 });
binaryTreeSchema.index({ leftChildId: 1 });
binaryTreeSchema.index({ rightChildId: 1 });
binaryTreeSchema.index({ level: 1 });
binaryTreeSchema.index({ path: 1 });

module.exports = mongoose.model('BinaryTree', binaryTreeSchema);
