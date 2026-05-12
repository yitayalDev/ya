const mongoose = require('mongoose');

const roomSchema = mongoose.Schema(
  {
    dormitory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dormitory',
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
    roomType: {
      type: String,
      enum: ['SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'],
      default: 'DOUBLE',
    },
    capacity: {
      type: Number,
      default: 2,
    },
    currentOccupancy: {
      type: Number,
      default: 0,
    },
    occupants: [
      {
        student: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        checkInDate: Date,
        checkOutDate: Date,
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
    amenities: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLOSED'],
      default: 'AVAILABLE',
    },
    notes: String,
  },
  {
    timestamps: true,
  },
);

roomSchema.index({ dormitory: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);