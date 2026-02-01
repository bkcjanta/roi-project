const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      required: true,
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    subject: {
      type: String,
      required: true,
    },
    
    category: {
      type: String,
      enum: ['kyc', 'withdrawal', 'investment', 'technical', 'other'],
      required: true,
    },
    
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    
    // Status
    status: {
      type: String,
      enum: ['open', 'in_progress', 'pending_user', 'resolved', 'closed'],
      default: 'open',
    },
    
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    assignedAt: Date,
    
    // Messages
    messages: [
      {
        senderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        senderRole: {
          type: String,
          enum: ['user', 'admin'],
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        attachments: [String],
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    
    // Timestamps
    lastReplyAt: Date,
    resolvedAt: Date,
    closedAt: Date,
  },
  {
    timestamps: true,
  }
);

// ==================== INDEXES ====================
supportTicketSchema.index({ userId: 1, status: 1 });
supportTicketSchema.index({ ticketId: 1 }, { unique: true });
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });

// ==================== PRE-SAVE MIDDLEWARE ====================
supportTicketSchema.pre('save', function (next) {
  if (!this.ticketId) {
    this.ticketId = `TKT-${uuidv4().substr(0, 8).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
