const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  attendanceSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceSession',
    required: true
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['PRESENT', 'LATE', 'ABSENT'],
    default: 'PRESENT'
  }
});

// Prevent duplicate attendance for the same session by the same student
attendanceSchema.index({ student: 1, attendanceSession: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);