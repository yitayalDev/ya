const mongoose = require('mongoose');

const transcriptOrderSchema = mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    orderType: {
      type: String,
      enum: ['OFFICIAL_TRANSCRIPT', 'STUDENT_COPY', 'LETTER_OF_GRADUATION', 'MEDIUM_OF_INSTRUCTION'],
      required: true
    },
    deliveryMethod: {
      type: String,
      enum: ['DIGITAL', 'PICKUP', 'MAIL'],
      default: 'DIGITAL'
    },
    destination: String, // Address or Email if MAILED/DIGITAL to third party
    purpose: String,
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'],
      default: 'PENDING'
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PAID', 'EXEMPT'],
      default: 'UNPAID'
    },
    fee: {
      type: Number,
      default: 0
    },
    trackingNumber: String,
    registrarNote: String,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    completedAt: Date
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('TranscriptOrder', transcriptOrderSchema);
