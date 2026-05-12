const mongoose = require('mongoose');

const medicalVisitSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
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
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vitals: {
    heartRate: Number,
    bloodPressure: String,
    temperature: Number,
    weight: Number
  },
  complaint: String,
  assessment: {
    type: String,
    required: true
  },
  diagnosis: String,
  notes: String,
  treatmentPlan: String,
  isFollowUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: Date,
  medicalCertificate: {
    issued: { type: Boolean, default: false },
    startDate: Date,
    endDate: Date,
    reason: String,
    issuedAt: Date
  },
  labOrders: [
    {
      testName: String,
      instructions: String,
      priority: { type: String, enum: ['NORMAL', 'URGENT'], default: 'NORMAL' },
      status: { type: String, enum: ['ORDERED', 'COLLECTED', 'COMPLETED'], default: 'ORDERED' }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('MedicalVisit', medicalVisitSchema);
