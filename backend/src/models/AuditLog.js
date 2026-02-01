const mongoose = require('mongoose');
const crypto = require('crypto');

const auditLogSchema = new mongoose.Schema(
  {
    // What happened
    entity: {
      type: String,
      required: true,
      enum: [
        'User',
        'Wallet',
        'Transaction',
        'Investment',
        'Withdrawal',
        'Package',
        'KYCDocument',
        'IncomeDistribution',
        'BinaryTree',
        'SystemSetting',
      ],
    },
    
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    
    action: {
      type: String,
      required: true,
      enum: [
        'created',
        'updated',
        'deleted',
        'status_changed',
        'approved',
        'rejected',
        'locked',
        'unlocked',
      ],
    },
    
    // Who did it
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    performedByRole: {
      type: String,
      enum: ['user', 'admin', 'superadmin', 'system'],
      required: true,
    },
    
    // Changes made
    changesBefore: {
      type: mongoose.Schema.Types.Mixed,
    },
    
    changesAfter: {
      type: mongoose.Schema.Types.Mixed,
    },
    
    fieldChanges: [
      {
        field: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
      },
    ],
    
    // Context
    ipAddress: String,
    userAgent: String,
    reason: String,
    
    // 🔥 SECURITY: Tamper-Proof Blockchain-style Hashing
    logHash: {
      type: String,
      required: true,
    },
    
    previousLogHash: {
      type: String,
      default: '0',
    },
    
    // Metadata
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    
    isSystemGenerated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: false, // We use custom timestamp field
  }
);

// ==================== INDEXES ====================
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });

// ==================== PRE-SAVE MIDDLEWARE ====================
auditLogSchema.pre('save', async function (next) {
  try {
    // Get previous log's hash
    const previousLog = await mongoose
      .model('AuditLog')
      .findOne()
      .sort({ timestamp: -1 })
      .select('logHash');
    
    this.previousLogHash = previousLog ? previousLog.logHash : '0';
    
    // Generate hash for this log
    const dataToHash = JSON.stringify({
      entity: this.entity,
      entityId: this.entityId,
      action: this.action,
      performedBy: this.performedBy,
      timestamp: this.timestamp,
      changesBefore: this.changesBefore,
      changesAfter: this.changesAfter,
      previousLogHash: this.previousLogHash,
    });
    
    this.logHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
    
    next();
  } catch (error) {
    next(error);
  }
});

// ==================== STATIC METHODS ====================

// Verify audit trail integrity
auditLogSchema.statics.verifyIntegrity = async function () {
  const logs = await this.find().sort({ timestamp: 1 });
  
  let previousHash = '0';
  let isValid = true;
  let invalidLogs = [];
  
  for (const log of logs) {
    if (log.previousLogHash !== previousHash) {
      isValid = false;
      invalidLogs.push({
        logId: log._id,
        expectedPreviousHash: previousHash,
        actualPreviousHash: log.previousLogHash,
      });
    }
    
    // Recalculate hash
    const dataToHash = JSON.stringify({
      entity: log.entity,
      entityId: log.entityId,
      action: log.action,
      performedBy: log.performedBy,
      timestamp: log.timestamp,
      changesBefore: log.changesBefore,
      changesAfter: log.changesAfter,
      previousLogHash: log.previousLogHash,
    });
    
    const calculatedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
    
    if (calculatedHash !== log.logHash) {
      isValid = false;
      invalidLogs.push({
        logId: log._id,
        expectedHash: calculatedHash,
        actualHash: log.logHash,
        tamperedFields: 'Hash mismatch - log may be tampered',
      });
    }
    
    previousHash = log.logHash;
  }
  
  return {
    isValid,
    totalLogs: logs.length,
    invalidLogs,
  };
};

// ==================== IMPORTANT ====================
// This collection should be:
// 1. Write-only (no updates/deletes in production)
// 2. Backed up daily to separate storage
// 3. Monitored for integrity violations

module.exports = mongoose.model('AuditLog', auditLogSchema);
