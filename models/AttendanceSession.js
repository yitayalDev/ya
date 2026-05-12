const mongoose = require('mongoose');
const crypto = require('crypto');

const attendanceSessionSchema = new mongoose.Schema({
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  qrToken: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate a unique session ID and encrypted QR token
attendanceSessionSchema.pre('validate', async function() {
  if (!this.sessionId) {
    // Generate a unique session ID
    this.sessionId = 'ATT_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  if (!this.qrToken) {
    // Generate a random token and encrypt it for the QR code
    const token = crypto.randomBytes(32).toString('hex');
    // In a real implementation, you would encrypt this token with a secret key
    // For simplicity, we're storing the token directly (in production, use encryption)
    this.qrToken = token;
  }
});

// Method to check if session is still valid
attendanceSessionSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive && now >= this.startTime && now <= this.endTime;
};

// Method to generate QR code data
attendanceSessionSchema.methods.getQrData = function() {
  return JSON.stringify({
    session_id: this.sessionId,
    timestamp: new Date().toISOString(),
    token: this.qrToken
  });
};

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);