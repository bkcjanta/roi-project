const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    // Basic Info
    userCode: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
      // Format: USR000001
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
    
    // Personal Details
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
    
    dateOfBirth: {
      type: Date,
    },
    
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    
    profilePicture: {
      type: String,
    },
    
    // Address
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
    
    // Bank Details
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
    
    // MLM/Referral
    referralCode: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
    },
    
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    sponsorCode: {
      type: String,
      uppercase: true,
    },
    
    placementPosition: {
      type: String,
      enum: ['left', 'right'],
    },
    
    // Security & Access
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user',
    },
    
    kycStatus: {
      type: String,
      enum: ['pending', 'submitted', 'under_review', 'approved', 'rejected'],
      default: 'pending',
    },
    
    kycRejectionReason: String,
    
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
    
    // Fraud Detection
    ipAddresses: [
      {
        ip: String,
        timestamp: Date,
        action: String,
      },
    ],
    
    deviceFingerprints: [String],
    
    lastLogin: Date,
    lastLoginIp: String,
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: Date,
    
    // MFA
    mfaSecret: String,
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    
    // Preferences
    notificationSettings: {
      email: {
        type: Boolean,
        default: true,
      },
      sms: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
    },
    
    language: {
      type: String,
      default: 'en',
    },
    
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    
    // Wallet References
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
    
    // Metadata
    registrationIp: String,
    registrationDevice: String,
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ mobile: 1 }, { unique: true });
userSchema.index({ userCode: 1 }, { unique: true });
userSchema.index({ referralCode: 1 }, { unique: true });
userSchema.index({ referredBy: 1 });
userSchema.index({ kycStatus: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });

// ==================== PRE-SAVE MIDDLEWARE ====================
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Generate userCode
userSchema.pre('save', async function (next) {
  if (!this.userCode) {
    const count = await mongoose.model('User').countDocuments();
    this.userCode = `USR${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Generate referralCode
userSchema.pre('save', function (next) {
  if (!this.referralCode) {
    this.referralCode = `REF${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  }
  next();
});

// ==================== METHODS ====================
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

userSchema.methods.isLocked = function () {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
};

userSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockedUntil && this.lockedUntil < Date.now()) {
    return this.updateOne({
      $set: { failedLoginAttempts: 1 },
      $unset: { lockedUntil: 1 },
    });
  }

  const updates = { $inc: { failedLoginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000;

  if (this.failedLoginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockedUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { failedLoginAttempts: 0 },
    $unset: { lockedUntil: 1 },
  });
};

// ==================== VIRTUALS ====================
userSchema.virtual('fullNameString').get(function () {
  return `${this.fullName.firstName} ${this.fullName.middleName || ''} ${this.fullName.lastName}`.trim();
});

module.exports = mongoose.model('User', userSchema);
