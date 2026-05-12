const mongoose = require('mongoose');

const academicProgramSchema = mongoose.Schema(
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
    college: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    durationYears: {
      type: Number,
      required: true,
      default: 4,
    },
    description: {
      type: String,
    },
    requiredCredits: {
      type: Number,
      required: true,
      default: 120,
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AcademicProgram', academicProgramSchema);
