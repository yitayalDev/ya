const mongoose = require('mongoose');

const courseSchema = mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please add a course code'],
      unique: true,
    },
    title: {
      type: String,
      required: [true, 'Please add a course title'],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: function() { return !this.isMasterCurriculum; },
    },
    college: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: function() { return !this.isMasterCurriculum; },
    },
    isMasterCurriculum: {
      type: Boolean,
      default: false,
    },
    credits: {
      type: Number,
      default: 3,
    },
    yearLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
      default: 1,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
      default: 1,
    },
    description: {
      type: String,
    },
    gradingStructure: [
      {
        component: { type: String, required: true }, // e.g., "Final Exam"
        weight: { type: Number, required: true }, // e.g., 40
      },
    ],
    leadInstructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    prerequisites: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    syllabus: String,
    objectives: [String],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Course', courseSchema);
