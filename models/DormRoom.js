const mongoose = require('mongoose');

const dormRoomSchema = mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, 'Please add a room number'],
    },
    floor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DormFloor',
      required: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Please add capacity'],
      default: 2,
    },
    genderType: {
      type: String,
      enum: ['MALE', 'FEMALE', 'MIXED'],
      default: 'MIXED',
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLOSED'],
      default: 'AVAILABLE',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DormRoom', dormRoomSchema);
