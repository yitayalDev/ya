const mongoose = require('mongoose');

const dormFloorSchema = mongoose.Schema(
  {
    floorNumber: {
      type: Number,
      required: [true, 'Please add a floor number'],
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DormBlock',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DormFloor', dormFloorSchema);
