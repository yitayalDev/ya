const mongoose = require('mongoose');

const academicBuildingSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      required: true,
    },
    type: {
      type: String,
      enum: ['ACADEMIC', 'ADMINISTRATIVE', 'LABORATORY', 'LIBRARY', 'SPORTS', 'OTHER'],
      default: 'ACADEMIC',
    },
    floors: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'UNDER_RENOVATION', 'CLOSED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AcademicBuilding', academicBuildingSchema);
