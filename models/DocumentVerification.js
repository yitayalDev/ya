const mongoose = require('mongoose');

const documentVerificationSchema = mongoose.Schema(
  {
    verificationCode: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    documentType: {
      type: String,
      required: true,
      enum: ['TRANSCRIPT', 'CLEARANCE', 'ENROLLMENT', 'GOOD_STANDING', 'LEAVE_OF_ABSENCE', 'GRADUATION_ELIGIBILITY']
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    studentId: String,
    studentName: String,
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    issuedAt: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: Map,
      of: String
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('DocumentVerification', documentVerificationSchema);
