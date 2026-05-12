const mongoose = require('mongoose');

const dormAnnouncementSchema = mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    targetType: {
      type: String,
      enum: ['ALL', 'CAMPUS', 'BUILDING', 'BLOCK'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DormAnnouncement', dormAnnouncementSchema);
