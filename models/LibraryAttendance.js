const mongoose = require('mongoose');

const libraryAttendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  library: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Library',
    required: true
  },
  checkIn: {
    type: Date,
    default: Date.now
  },
  checkOut: {
    type: Date
  },
  status: {
    type: String,
    enum: ['INSIDE', 'OUT'],
    default: 'INSIDE'
  }
}, { timestamps: true });

// Index for quick count queries
libraryAttendanceSchema.index({ library: 1, status: 1 });

module.exports = mongoose.model('LibraryAttendance', libraryAttendanceSchema);
