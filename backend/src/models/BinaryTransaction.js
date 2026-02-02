const mongoose = require('mongoose');

const binaryTransactionSchema = new mongoose.Schema(
  {
    // Transaction ID
    binaryTxnId: {
      type: String,
      unique: true,
      required: true,
    },

    // ==================== USER ====================
    
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

    // ==================== CYCLE INFO ====================
    
    cycleDate: {
      type: Date,
      required: true,
      index: true,
    },

    cycleType: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily',
    },

    // ==================== BUSINESS VOLUMES ====================
    
    // Current cycle business
    leftBusiness: {
      type: mongoose.Schema.Types.Decimal128,
      get: (v) => parseFloat(v?.toString() || 0),
    },

    rightBusiness: {
      type: mongoose.Schema.Types.Decimal128,
      get: (v) => parseFloat(v?.toString() || 0),
    },

    // Previous carry forward
    previousCarryForward: {
      left: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
        get: (v) => parseFloat(v?.toString() || 0),
      },
      right: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
        get: (v) => parseFloat(v?.toString() || 0),
      },
    },

    // Total business (current + carry)
    totalLeftBusiness: {
      type: mongoose.Schema.Types.Decimal128,
      get: (v) => parseFloat(v?.toString() || 0),
    },

    totalRightBusiness: {
      type: mongoose.Schema.Types.Decimal128,
      get: (v) => parseFloat(v?.toString() || 0),
    },

    // ==================== PAIR CALCULATION ====================
    
    pairValue: {
      type: mongoose.Schema.Types.Decimal128,
      default: 1000,
      get: (v) => parseFloat(v?.toString() || 0),
    },

    pairsMatched: {
      type: Number,
      default: 0,
    },

    // ==================== COMMISSION ====================
    
    commissionPerPair: {
      type: mongoose.Schema.Types.Decimal128,
      default: 100,
      get: (v) => parseFloat(v?.toString() || 0),
    },

    grossCommission: {
      type: mongoose.Schema.Types.Decimal128,
      get: (v) => parseFloat(v?.toString() || 0),
    },

    // Capping
    cappingApplied: {
      type: Boolean,
      default: false,
    },

    cappingLimit: {
      type: mongoose.Schema.Types.Decimal128,
      get: (v) => parseFloat(v?.toString() || 0),
    },

    finalCommission: {
      type: mongoose.Schema.Types.Decimal128,
      get: (v) => parseFloat(v?.toString() || 0),
    },

    // ==================== NEW CARRY FORWARD ====================
    
    newCarryForward: {
      left: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
        get: (v) => parseFloat(v?.toString() || 0),
      },
      right: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
        get: (v) => parseFloat(v?.toString() || 0),
      },
    },

    // ==================== STATUS ====================
    
    status: {
      type: String,
      enum: ['calculated', 'approved', 'paid', 'rejected'],
      default: 'calculated',
      index: true,
    },

    paidAt: Date,

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },

    commissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Commission',
    },

    // ==================== METADATA ====================
    
    metadata: {
      totalLeftMembers: Number,
      totalRightMembers: Number,
      weakerLeg: String, // 'left' or 'right'
      strongerLeg: String,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// ==================== INDEXES ====================

binaryTransactionSchema.index({ userId: 1, cycleDate: -1 });
binaryTransactionSchema.index({ cycleDate: 1, status: 1 });
binaryTransactionSchema.index({ binaryTxnId: 1 }, { unique: true });

// ==================== PRE-SAVE HOOK ====================

binaryTransactionSchema.pre('save', function (next) {
  if (this.isNew && !this.binaryTxnId) {
    this.binaryTxnId = `BIN-${Date.now().toString(36).toUpperCase()}${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;
  }
  next();
});

// ==================== VIRTUAL FIELDS ====================

binaryTransactionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

module.exports = mongoose.model('BinaryTransaction', binaryTransactionSchema);
