const mongoose = require('mongoose');

const cronJobSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      unique: true,
      required: true,
      enum: [
        'daily_roi_distribution',
        'binary_income_calculation',
        'level_income_calculation',
        'investment_status_update',
        'notification_cleanup',
        'pending_withdrawal_reminder',
        'kyc_reminder',
        'inactive_user_cleanup',
        'database_backup',
        'audit_log_backup',
      ],
    },
    
    // Schedule Configuration
    schedule: {
      type: String,
      required: true,
      // Cron format: "0 0 * * *" (daily at midnight)
    },
    
    description: {
      type: String,
      required: true,
    },
    
    // Execution Status
    status: {
      type: String,
      enum: ['idle', 'running', 'completed', 'failed', 'paused'],
      default: 'idle',
    },
    
    isEnabled: {
      type: Boolean,
      default: true,
    },
    
    // Execution Tracking
    lastExecutionTime: {
      type: Date,
    },
    
    nextExecutionTime: {
      type: Date,
    },
    
    lastExecutionStatus: {
      type: String,
      enum: ['success', 'failed', 'partial'],
    },
    
    lastExecutionDuration: {
      type: Number, // milliseconds
    },
    
    // Execution History (Last 10 runs)
    executionHistory: [
      {
        startTime: {
          type: Date,
          required: true,
        },
        endTime: {
          type: Date,
        },
        status: {
          type: String,
          enum: ['success', 'failed', 'partial'],
          required: true,
        },
        duration: {
          type: Number, // milliseconds
        },
        recordsProcessed: {
          type: Number,
          default: 0,
        },
        recordsFailed: {
          type: Number,
          default: 0,
        },
        errorMessage: {
          type: String,
        },
        errorStack: {
          type: String,
        },
        logs: [String], // Important messages during execution
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          // Job-specific data (e.g., total ROI distributed, users processed)
        },
      },
    ],
    
    // Performance Metrics
    totalExecutions: {
      type: Number,
      default: 0,
    },
    
    successfulExecutions: {
      type: Number,
      default: 0,
    },
    
    failedExecutions: {
      type: Number,
      default: 0,
    },
    
    averageExecutionTime: {
      type: Number, // milliseconds
      default: 0,
    },
    
    // Lock Mechanism (Prevent concurrent execution)
    isLocked: {
      type: Boolean,
      default: false,
    },
    
    lockedAt: {
      type: Date,
    },
    
    lockedBy: {
      type: String, // Process ID or server identifier
    },
    
    lockExpiry: {
      type: Date,
    },
    
    // Retry Configuration
    retryCount: {
      type: Number,
      default: 0,
    },
    
    maxRetries: {
      type: Number,
      default: 3,
    },
    
    retryDelay: {
      type: Number, // milliseconds
      default: 60000, // 1 minute
    },
    
    // Alert Configuration
    alertOnFailure: {
      type: Boolean,
      default: true,
    },
    
    alertEmails: [String],
    
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
    
    maxConsecutiveFailures: {
      type: Number,
      default: 3, // Alert after 3 consecutive failures
    },
    
    // Timeout
    timeout: {
      type: Number, // milliseconds
      default: 300000, // 5 minutes
    },
    
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// ==================== INDEXES ====================
cronJobSchema.index({ jobName: 1 }, { unique: true });
cronJobSchema.index({ status: 1, isEnabled: 1 });
cronJobSchema.index({ nextExecutionTime: 1, isEnabled: 1 });
cronJobSchema.index({ lastExecutionTime: -1 });

// ==================== METHODS ====================

// Acquire lock before execution
cronJobSchema.methods.acquireLock = async function (processId) {
  const now = new Date();
  const lockDuration = this.timeout + 60000; // timeout + 1 minute buffer
  const lockExpiry = new Date(now.getTime() + lockDuration);
  
  // Check if already locked and not expired
  if (this.isLocked && this.lockExpiry > now) {
    return false;
  }
  
  // Acquire lock
  const result = await this.constructor.updateOne(
    {
      _id: this._id,
      $or: [
        { isLocked: false },
        { lockExpiry: { $lte: now } },
      ],
    },
    {
      $set: {
        isLocked: true,
        lockedAt: now,
        lockedBy: processId,
        lockExpiry: lockExpiry,
        status: 'running',
      },
    }
  );
  
  return result.modifiedCount === 1;
};

// Release lock after execution
cronJobSchema.methods.releaseLock = async function () {
  return this.updateOne({
    $set: {
      isLocked: false,
      status: 'idle',
    },
    $unset: {
      lockedAt: 1,
      lockedBy: 1,
      lockExpiry: 1,
    },
  });
};

// Record execution result
cronJobSchema.methods.recordExecution = async function (executionData) {
  const {
    startTime,
    endTime,
    status,
    recordsProcessed = 0,
    recordsFailed = 0,
    errorMessage = null,
    errorStack = null,
    logs = [],
    metadata = {},
  } = executionData;
  
  const duration = endTime - startTime;
  
  // Update execution history (keep last 10)
  const execution = {
    startTime,
    endTime,
    status,
    duration,
    recordsProcessed,
    recordsFailed,
    errorMessage,
    errorStack,
    logs,
    metadata,
  };
  
  // Calculate new average execution time
  const newAverage = Math.round(
    (this.averageExecutionTime * this.totalExecutions + duration) / (this.totalExecutions + 1)
  );
  
  // Update consecutive failures
  let consecutiveFailures = this.consecutiveFailures;
  if (status === 'failed') {
    consecutiveFailures++;
  } else if (status === 'success') {
    consecutiveFailures = 0;
  }
  
  await this.updateOne({
    $push: {
      executionHistory: {
        $each: [execution],
        $position: 0,
        $slice: 10, // Keep only last 10
      },
    },
    $set: {
      lastExecutionTime: endTime,
      lastExecutionStatus: status,
      lastExecutionDuration: duration,
      averageExecutionTime: newAverage,
      consecutiveFailures: consecutiveFailures,
      retryCount: 0, // Reset retry count on completion
    },
    $inc: {
      totalExecutions: 1,
      successfulExecutions: status === 'success' ? 1 : 0,
      failedExecutions: status === 'failed' ? 1 : 0,
    },
  });
};

// Check if alert should be sent
cronJobSchema.methods.shouldAlert = function () {
  return (
    this.alertOnFailure &&
    this.consecutiveFailures >= this.maxConsecutiveFailures
  );
};

// ==================== STATIC METHODS ====================

// Get jobs to execute now
cronJobSchema.statics.getJobsToExecute = async function () {
  const now = new Date();
  
  return this.find({
    isEnabled: true,
    isLocked: false,
    nextExecutionTime: { $lte: now },
  });
};

// Get failed jobs
cronJobSchema.statics.getFailedJobs = async function () {
  return this.find({
    lastExecutionStatus: 'failed',
    isEnabled: true,
  });
};

// Get job statistics
cronJobSchema.statics.getStatistics = async function () {
  const jobs = await this.find();
  
  return jobs.map((job) => ({
    jobName: job.jobName,
    status: job.status,
    isEnabled: job.isEnabled,
    totalExecutions: job.totalExecutions,
    successRate: job.totalExecutions > 0
      ? ((job.successfulExecutions / job.totalExecutions) * 100).toFixed(2)
      : 0,
    averageExecutionTime: job.averageExecutionTime,
    lastExecutionTime: job.lastExecutionTime,
    lastExecutionStatus: job.lastExecutionStatus,
    consecutiveFailures: job.consecutiveFailures,
    nextExecutionTime: job.nextExecutionTime,
  }));
};

module.exports = mongoose.model('CronJob', cronJobSchema);
