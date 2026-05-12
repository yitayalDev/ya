const mongoose = require('mongoose');

const sectionSchema = mongoose.Schema(
  {
    sectionName: {
      type: String, // e.g., "A", "B", "C"
      required: [true, 'Please add a section name'],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: true,
    },
    classroom: {
      type: String,
      required: [true, 'Please add a classroom'],
    },
    capacity: {
      type: Number,
      required: [true, 'Please add capacity'],
      min: [1, 'Capacity must be at least 1'],
    },
    enrolledCount: {
      type: Number,
      default: 0,
    },
    schedule: [
      {
        day: {
          type: String,
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          required: true,
        },
        startTime: {
          type: String, // e.g., "09:00" (HH:mm)
          required: true,
        },
        endTime: {
          type: String, // e.g., "10:30" (HH:mm)
          required: true,
        },
      },
    ],
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure section name is unique per course within the same academic calendar
sectionSchema.index({ course: 1, sectionName: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Section', sectionSchema);
