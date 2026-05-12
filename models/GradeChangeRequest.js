const mongoose = require('mongoose');

const gradeChangeRequestSchema = mongoose.Schema(
  {
    originalGrade: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinalGrade',
      required: false
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: false
    },
    type: {
      type: String,
      enum: ['REQUEST', 'APPEAL'],
      default: 'REQUEST'
    },
    oldScore: Number,
    oldGrade: String,
    newScore: Number,
    newGrade: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    registrarComment: String,
    processedAt: Date
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('GradeChangeRequest', gradeChangeRequestSchema);
