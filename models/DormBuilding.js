const mongoose = require('mongoose');

const dormBuildingSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a building name'],
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      required: true,
    },
    description: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DormBuilding', dormBuildingSchema);
