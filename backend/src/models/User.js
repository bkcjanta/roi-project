const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    // ==================== BASIC INFO ====================
    
    userCode: {
      type: String,
      unique: true,
      uppercase: true,
      sparse: true,
    },
    
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },
    
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian mobile number'],
    },
    
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    
    // ==================== PERSONAL DETAILS ====================
    
    fullName: {
      firstName: {
        type: String,
        required: true,
        trim: true,
      },
      middleName: {
        type: String,
        trim: true,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
      },
    },
    
    dateOfBirth: Date,
    
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    
    profilePicture: String,
    
    // ==================== ADDRESS ====================
    
    address: {
      street: String,
      city: String,
      state: String,
      country: {
        type: String,
        default: 'IN',
      },
      postalCode: String,
      addressProof: String,
    },
    
    // ==================== BANK DETAILS ====================
    
    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: {
        type: String,
        uppercase: true,
        match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'],
      },
      bankName: String,
      branch: String,
      isVerified: {
        type: Boolean,
        default: false,
      },
    },
    
    // ==================== REFERRAL/LEVEL INCOME SYSTEM ====================
    
    // Referral code (for sharing with others)
    referralCode: {
      type: String,
      unique: true,
      uppercase: true,
      sparse: true,
    },
    
    // Direct sponsor (who referred this user)
    sponsorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    
    sponsorCode: {
      type: String,
      uppercase: true,
      index: true,
    },
    
    // ✅ NEW: Pre-calculated upline chain (Level 1 to 5)
    // This makes commission calculation SUPER FAST
    uplineChain: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      userCode: String,
      level: Number, // 1, 2, 3, 4, 5
    }],
    
    // ✅ NEW: Team counts (auto-updated on registration)
    teamCount: {
      level1: { type: Number, default: 0 }, // Direct referrals
      level2: { type: Number, default: 0 },
      level3: { type: Number, default: 0 },
      level4: { type: Number, default: 0 },
      level5: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    
    // Legacy fields (for backward compatibility)
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    totalDirectReferrals: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    totalTeamSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // ==================== BINARY INCOME SYSTEM ====================
    
    // ✅ NEW: Binary tree parent
    binaryParentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    
    // ✅ NEW: Position in parent's tree
    binaryPosition: {
      type: String,
      enum: ['left', 'right', null],
      default: null,
    },
    
    // ✅ NEW: Binary tree statistics
    binaryTeam: {
      // Member counts
      leftCount: { type: Number, default: 0 },
      rightCount: { type: Number, default: 0 },
      
      // Business volumes
      leftBusiness: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0, 
        get: v => parseFloat(v?.toString() || 0)
      },
      rightBusiness: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: v => parseFloat(v?.toString() || 0)
      },
      
      // Pair tracking
      totalPairs: { type: Number, default: 0 },
      
      // Carry forward (unused business from previous cycle)
      carryForward: {
        left: { 
          type: mongoose.Schema.Types.Decimal128, 
          default: 0,
          get: v => parseFloat(v?.toString() || 0)
        },
        right: { 
          type: mongoose.Schema.Types.Decimal128, 
          default: 0,
          get: v => parseFloat(v?.toString() || 0)
        },
      },
    },
    
    // ==================== SECURITY & ACCESS ====================
    
    role: {
      type: String,
      enum: ['user', 'admin', 'super_admin'],
      default: 'user',
    },
    
    kycStatus: {
      type: String,
      enum: ['pending', 'submitted', 'under_review', 'approved', 'rejected'],
      default: 'pending',
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
    
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    
    isMobileVerified: {
      type: Boolean,
      default: false,
    },
    
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'blocked', 'deleted'],
      default: 'active',
    },
    
    // ==================== SECURITY TRACKING ====================
    
    lastLogin: Date,
    lastLoginIp: String,
    
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    
    lockedUntil: Date,
    
    // ==================== WALLET REFERENCES ====================
    
    wallets: {
      main: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
      },
      income: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
      },
      roi: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
      },
    },
    
    // ==================== METADATA ====================
    
    registrationIp: String,
    registrationDevice: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
  }
);

// ==================== INDEXES ====================

userSchema.index({ email: 1 });
userSchema.index({ mobile: 1 });
userSchema.index({ userCode: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ sponsorId: 1 });
userSchema.index({ binaryParentId: 1 });
userSchema.index({ 'uplineChain.userId': 1 });
userSchema.index({ accountStatus: 1, isActive: 1 });

// ==================== PRE-SAVE HOOKS ====================

// Hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Sync legacy fields
userSchema.pre('save', function (next) {
  // Sync referredBy with sponsorId
  if (this.isModified('sponsorId') && !this.referredBy) {
    this.referredBy = this.sponsorId;
  }
  
  // Sync totalDirectReferrals with teamCount.level1
  if (this.isModified('teamCount.level1')) {
    this.totalDirectReferrals = this.teamCount.level1;
  }
  
  // Sync totalTeamSize with teamCount.total
  if (this.isModified('teamCount.total')) {
    this.totalTeamSize = this.teamCount.total;
  }
  
  next();
});

// ==================== INSTANCE METHODS ====================

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function () {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  if (this.lockedUntil && this.lockedUntil < Date.now()) {
    return this.updateOne({
      $set: { failedLoginAttempts: 1 },
      $unset: { lockedUntil: 1 },
    });
  }

  const updates = { $inc: { failedLoginAttempts: 1 } };

  if (this.failedLoginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockedUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { failedLoginAttempts: 0 },
    $unset: { lockedUntil: 1 },
  });
};

// ✅ NEW: Get upline at specific level
userSchema.methods.getUplineAtLevel = function (level) {
  return this.uplineChain.find(upline => upline.level === level);
};

// ==================== VIRTUAL FIELDS ====================

// Full name string
userSchema.virtual('fullNameString').get(function () {
  return `${this.fullName.firstName} ${this.fullName.middleName || ''} ${this.fullName.lastName}`.trim();
});

// ✅ NEW: Binary position display
userSchema.virtual('binaryPositionDisplay').get(function () {
  if (!this.binaryParentId) return 'Root';
  return `${this.binaryPosition} leg`;
});

module.exports = mongoose.model('User', userSchema);
