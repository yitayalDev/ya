const mongoose = require('mongoose');

const announcementSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: ['ALL', 'COLLEGE', 'DEPARTMENT', 'YEAR_LEVEL'],
      default: 'ALL',
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId, // ID of College or Department if targetType is set
    },
    targetYear: String, // e.g., "Year 1" if targetType is YEAR_LEVEL
    priority: {
      type: String,
      enum: ['NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    scheduledFor: Date,
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED'],
      default: 'PUBLISHED',
    },
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Announcement', announcementSchema);
