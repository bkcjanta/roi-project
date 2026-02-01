const mongoose = require('mongoose');

const kycDocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    documentType: {
      type: String,
      enum: ['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id'],
      required: true,
    },
    
    documentNumber: {
      type: String,
      required: true,
    },
    
    documentFrontUrl: {
      type: String,
      required: true,
    },
    
    documentBackUrl: String,
    
    selfieUrl: String,
    
    // Verification
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected'],
      default: 'pending',
    },
    
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    verifiedAt: Date,
    rejectionReason: String,
    
    // Metadata
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    
    expiryDate: Date,
    
    aiVerificationScore: Number,
    aiVerificationDetails: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// ==================== INDEXES ====================
kycDocumentSchema.index({ userId: 1, status: 1 });
kycDocumentSchema.index({ documentType: 1, userId: 1 });

module.exports = mongoose.model('KYCDocument', kycDocumentSchema);
