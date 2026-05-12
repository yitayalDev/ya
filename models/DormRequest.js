const mongoose = require('mongoose');

const dormRequestSchema = mongoose.Schema(
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
    requestType: {
      type: String,
      enum: ['ROOM_CHANGE', 'MAINTENANCE', 'CHECKOUT', 'CHECKIN', 'ROOM_UPGRADE', 'OTHER'],
      required: true,
    },
    category: {
      type: String,
      enum: ['ELECTRICITY', 'WATER', 'FURNITURE', 'INTERNET', 'SECURITY', 'OTHER'],
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED'],
      default: 'PENDING',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    responseNotes: String,
    responseDate: Date,
    attachments: [
      {
        url: String,
        filename: String,
      },
    ],
    scheduledDate: Date,
    completedDate: Date,
    needsAdminReview: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('DormRequest', dormRequestSchema);