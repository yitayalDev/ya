const mongoose = require('mongoose');

const dormBlockSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a block name'],
    },
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DormBuilding',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DormBlock', dormBlockSchema);
