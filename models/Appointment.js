const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalStaff'
  },
  appointmentType: {
    type: String,
    enum: ['CONSULTATION', 'COUNSELING', 'COUNSELLING', 'FOLLOW_UP', 'EMERGENCY', 'PROCEDURE', 'IN_PERSON', 'VIRTUAL'],
    default: 'CONSULTATION'
  },
  sessionType: {
    type: String,
    enum: ['PHYSICAL', 'VIDEO'],
    default: 'PHYSICAL'
  },
  reason: {
    type: String,
    required: true
  },
  symptoms: [String],
  scheduledDate: {
    type: Date,
    required: true
  },
  timeSlot: String,
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NOSHOW'],
    default: 'PENDING'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'],
    default: 'LOW'
  },
  queueNumber: Number,
  checkInTime: Date,
  aiTriage: {
    reasoning: String,
    confidence: Number,
    flaggedKeywords: [String]
  },
  videoSession: {
    roomName: String,
    provider: {
      type: String,
      default: 'LIVEKIT'
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'LIVE', 'COMPLETED', 'EXPIRED'],
      default: 'SCHEDULED'
    },
    startsAt: Date,
    endsAt: Date,
    hostJoinedAt: Date,
    participantJoinedAt: Date,
    endedAt: Date,
    joinTokenExpiresAt: Date,
    durationMinutes: {
      type: Number,
      default: 30
    },
    recordingEnabled: {
      type: Boolean,
      default: false
    },
    recordingConsentStudent: {
      type: Boolean,
      default: false
    },
    recordingConsentDoctor: {
      type: Boolean,
      default: false
    },
    notes: {
      sessionNotes: String,
      observations: String,
      followUpPlan: String,
      updatedAt: Date,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
