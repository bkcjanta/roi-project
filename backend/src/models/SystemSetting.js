const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    settingKey: {
      type: String,
      unique: true,
      required: true,
    },
    
    settingValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    
    dataType: {
      type: String,
      enum: ['boolean', 'number', 'string', 'json'],
      required: true,
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
    
    description: String,
    
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// ==================== INDEXES ====================
systemSettingSchema.index({ settingKey: 1 }, { unique: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
