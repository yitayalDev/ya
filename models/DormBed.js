const mongoose = require('mongoose');

const dormBedSchema = mongoose.Schema(
  {
    bedNumber: {
      type: String,
      required: [true, 'Please add a bed number'],
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DormRoom',
      required: true,
    },
    isOccupied: {
      type: Boolean,
      default: false,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DormBed', dormBedSchema);
