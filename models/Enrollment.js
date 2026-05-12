const mongoose = require('mongoose');

const enrollmentSchema = mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: true,
    },
    status: {
      type: String,
      enum: ['Enrolled', 'Completed', 'Dropped', 'Withdrawn'],
      default: 'Enrolled',
    },
    grades: [
      {
        componentName: String, // e.g., "Mid Exam"
        score: Number,
        weight: Number,
      }
    ],
    finalGrade: String, // e.g., "A", "B+"
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate enrollment in the same course for the same student in the same semester
enrollmentSchema.index({ student: 1, course: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
