const mongoose = require('mongoose');


const commissionSchema = new mongoose.Schema(
  {
    // Commission ID
    commissionId: {
      type: String,
      unique: true,
      required: true,
    },


    // ==================== WHO RECEIVES ====================
    
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


    // ==================== WHO GENERATED ====================
    
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },


    fromUserCode: {
      type: String,
      required: true,
    },


    // ==================== COMMISSION TYPE ====================
    
    type: {
      type: String,
      enum: ['level', 'binary', 'directreferral', 'matching'],  // ✅ CHANGED (removed underscore)
      required: true,
      index: true,
    },


    // ==================== AMOUNT DETAILS ====================
    
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v?.toString() || 0),
    },


    percentage: {
      type: Number, // e.g., 10 for 10%
      required: true,
    },


    // ==================== LEVEL INCOME SPECIFIC ====================
    
    level: {
      type: Number, // 1, 2, 3, 4, 5
      min: 1,
      max: 10,
    },


    // ==================== BINARY INCOME SPECIFIC ====================
    
    binaryInfo: {
      leftBusiness: {
        type: mongoose.Schema.Types.Decimal128,
        get: (v) => parseFloat(v?.toString() || 0),
      },
      rightBusiness: {
        type: mongoose.Schema.Types.Decimal128,
        get: (v) => parseFloat(v?.toString() || 0),
      },
      pairs: Number,
      pairValue: {
        type: mongoose.Schema.Types.Decimal128,
        get: (v) => parseFloat(v?.toString() || 0),
      },
    },


    // ==================== SOURCE ====================
    
    sourceType: {
      type: String,
      enum: ['investment', 'package_purchase', 'binary_pairing', 'recharge'],
      required: true,
    },


    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },


    sourceAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => parseFloat(v?.toString() || 0),
    },


    // ==================== STATUS ====================
    
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'rejected', 'cancelled'],
      default: 'approved', // Auto-approve by default
      index: true,
    },


    // ==================== PAYMENT DETAILS ====================
    
    paidAt: Date,


    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },


    transactionId: {
      type: String,  // ✅ CHANGED from ObjectId to String
    },


    // ==================== ADMIN ACTIONS ====================
    
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },


    approvedAt: Date,


    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },


    rejectedAt: Date,


    rejectionReason: String,


    adminNote: String,


    // ==================== METADATA ====================
    
    metadata: {
      ipAddress: String,
      userAgent: String,
      notes: String,
      packageName: String,  // ✅ ADDED
      note: String,         // ✅ ADDED
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);


// ==================== INDEXES ====================


commissionSchema.index({ userId: 1, type: 1, status: 1 });
commissionSchema.index({ fromUserId: 1, createdAt: -1 });
commissionSchema.index({ commissionId: 1 }, { unique: true });
commissionSchema.index({ status: 1, createdAt: -1 });
commissionSchema.index({ transactionId: 1 });


// ==================== PRE-SAVE HOOK ====================


commissionSchema.pre('save', function (next) {
  if (this.isNew && !this.commissionId) {
    // Generate commission ID: COM-XXXXXXXX
    this.commissionId = `COM-${Date.now().toString(36).toUpperCase()}${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;
  }
  next();
});


// ==================== VIRTUAL FIELDS ====================


commissionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});


commissionSchema.virtual('statusDisplay').get(function () {
  const statusMap = {
    pending: 'Pending Approval',
    approved: 'Approved',
    paid: 'Paid',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };
  return statusMap[this.status] || this.status;
});


// ==================== STATIC METHODS ====================


// Get total commission by user and type
commissionSchema.statics.getTotalByUser = async function (userId, type, status = 'paid') {
  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: type,
        status: status,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $toDouble: '$amount' } },
        count: { $sum: 1 },
      },
    },
  ]);


  return result[0] || { total: 0, count: 0 };
};


// Get level-wise breakdown
commissionSchema.statics.getLevelWiseStats = async function (userId) {
  return await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: 'level',
        status: 'paid',
      },
    },
    {
      $group: {
        _id: '$level',
        total: { $sum: { $toDouble: '$amount' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};


module.exports = mongoose.model('Commission', commissionSchema);
