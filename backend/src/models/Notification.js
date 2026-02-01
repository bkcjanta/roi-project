const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    type: {
      type: String,
      enum: [
        'system',
        'roi_credit',
        'investment',
        'withdrawal',
        'kyc',
        'referral',
        'announcement',
      ],
      required: true,
    },
    
    title: {
      type: String,
      required: true,
    },
    
    message: {
      type: String,
      required: true,
    },
    
    actionUrl: String,
    
    // Status
    isRead: {
      type: Boolean,
      default: false,
    },
    
    readAt: Date,
    
    // Channels
    channels: {
      inApp: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: false,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      push: {
        type: Boolean,
        default: false,
      },
    },
    
    // Priority
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

// ==================== INDEXES ====================
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
