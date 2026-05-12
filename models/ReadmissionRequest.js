const mongoose = require('mongoose');

const readmissionRequestSchema = mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    requestedSemester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: true
    },
    requestedYear: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    supportingDocuments: [String], // URLs to docs
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },
    registrarComment: String,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    processedAt: Date
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ReadmissionRequest', readmissionRequestSchema);
