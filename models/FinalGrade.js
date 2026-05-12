const mongoose = require('mongoose');

const finalGradeSchema = mongoose.Schema(
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
    totalScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    gradeLetter: {
      type: String,
      required: true,
      enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'],
    },
    gpaPoint: {
      type: Number,
      required: true,
      min: 0,
      max: 4.0,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'DEPARTMENT_APPROVED', 'APPROVED', 'REJECTED', 'LOCKED'],
      default: 'DRAFT',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    submittedAt: {
      type: Date,
    },
    departmentApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    departmentApprovedAt: {
      type: Date,
    },
    departmentRemark: {
      type: String,
      trim: true,
      maxlength: [500, 'Remark cannot exceed 500 characters'],
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lockedAt: {
      type: Date,
    },
    isGradeModerationApplied: {
      type: Boolean,
      default: false,
    },
    originalTotalScore: {
      type: Number,
    },
    moderationReason: {
      type: String,
      trim: true,
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

// Prevent duplicate final grades
finalGradeSchema.index(
  { student: 1, course: 1, section: 1, semester: 1 },
  { unique: true }
);

// Index for status queries
finalGradeSchema.index({ status: 1 });
finalGradeSchema.index({ semester: 1, course: 1 });

module.exports = mongoose.model('FinalGrade', finalGradeSchema);
