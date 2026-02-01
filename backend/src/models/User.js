const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    // Basic Info
    userCode: {
      type: String,
      unique: true,
      uppercase: true,
      sparse: true, // Allow null for unique index
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
    
    dateOfBirth: Date,
    
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    
    profilePicture: String,
    
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
      uppercase: true,
      sparse: true,
    },
    
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    sponsorCode: String,
    
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
    
    // Security Tracking
    lastLogin: Date,
    lastLoginIp: String,
    
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    
    lockedUntil: Date,
    
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes (removed duplicate definitions)
userSchema.index({ email: 1 });
userSchema.index({ mobile: 1 });
userSchema.index({ userCode: 1 });
userSchema.index({ referralCode: 1 });

// Pre-save: Hash password
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

// Method: Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method: Check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
};

// Method: Increment login attempts
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

// Method: Reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { failedLoginAttempts: 0 },
    $unset: { lockedUntil: 1 },
  });
};

// Virtual: Full name string
userSchema.virtual('fullNameString').get(function () {
  return `${this.fullName.firstName} ${this.fullName.middleName || ''} ${this.fullName.lastName}`.trim();
});

module.exports = mongoose.model('User', userSchema);
