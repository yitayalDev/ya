const mongoose = require('mongoose');

const academicRoomSchema = mongoose.Schema(
  {
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicBuilding',
      required: true,
    },
    roomNumber: {
      type: String,
      required: true,
    },
    floor: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['CLASSROOM', 'LAB', 'OFFICE', 'AUDITORIUM', 'CONFERENCE', 'MEETING'],
      default: 'CLASSROOM',
    },
    capacity: {
      type: Number,
      required: true,
    },
    facilities: [String], // e.g., ["Projector", "AC", "Computers"]
    status: {
      type: String,
      enum: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'CLOSED'],
      default: 'AVAILABLE',
    },
  },
  {
    timestamps: true,
  }
);

academicRoomSchema.index({ building: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('AcademicRoom', academicRoomSchema);
