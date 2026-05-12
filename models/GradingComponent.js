const mongoose = require('mongoose');

const gradingComponentSchema = mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Please add component name'],
      trim: true,
    },
    weight: {
      type: Number,
      required: [true, 'Please add weight'],
      min: [0, 'Weight cannot be negative'],
    },
    maxScore: {
      type: Number,
      required: [true, 'Please add maximum score'],
      min: [1, 'Max score must be at least 1'],
      default: 100,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
    },
    sequenceOrder: {
      type: Number,
      default: 1,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure unique component names per course
gradingComponentSchema.index({ course: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('GradingComponent', gradingComponentSchema);
