const mongoose = require('mongoose');

const violationSchema = mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dormitory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dormitory',
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
    },
    violationType: {
      type: String,
      enum: [
        'NOISE_VIOLATION',
        'DAMAGE_PROPERTY',
        'VISITOR_VIOLATION',
        'CURFEW_VIOLATION',
        'PROHIBITED_ITEMS',
        'CLEANLINESS',
        'UNAUTHORIZED_GUEST',
        'ELECTRICAL_VIOLATION',
        'LATE_ENTRY',
        'OTHER',
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['MINOR', 'MODERATE', 'MAJOR', 'SEVERE'],
      default: 'MINOR',
    },
    status: {
      type: String,
      enum: ['REPORTED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'],
      default: 'REPORTED',
    },
    evidence: [
      {
        url: String,
        filename: String,
      },
    ],
    responseNotes: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedDate: Date,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Violation', violationSchema);