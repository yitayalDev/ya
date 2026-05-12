const mongoose = require('mongoose');

const gradeSchema = mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: true,
    },
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GradingComponent',
      required: true,
    },
    score: {
      type: Number,
      required: [true, 'Score is required'],
      min: [0, 'Score cannot be negative'],
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gradedAt: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Remarks cannot exceed 500 characters'],
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate grade entries for same student, course, section, component
gradeSchema.index(
  { student: 1, course: 1, section: 1, component: 1 },
  { unique: true }
);

// Compound index for efficient queries
gradeSchema.index({ section: 1, component: 1 });
gradeSchema.index({ student: 1, semester: 1 });

module.exports = mongoose.model('Grade', gradeSchema);
