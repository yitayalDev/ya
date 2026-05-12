const mongoose = require('mongoose');

const courseSubstitutionSchema = mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    requiredCourse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    substitutedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: String,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate substitutions for the same required course for a student
courseSubstitutionSchema.index({ student: 1, requiredCourse: 1 }, { unique: true });

module.exports = mongoose.model('CourseSubstitution', courseSubstitutionSchema);
