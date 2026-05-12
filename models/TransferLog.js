const mongoose = require('mongoose');

const transferLogSchema = mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['Student', 'Staff', 'Department', 'College'],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    fromCampus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      required: true,
    },
    toCampus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    transferDate: {
      type: Date,
      default: Date.now,
    },
    additionalNotes: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TransferLog', transferLogSchema);