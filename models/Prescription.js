const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalVisit',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  medications: [{
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalStock'
    },
    medicineName: String, // Fallback if not in stock
    dosage: {
      type: String,
      required: true // e.g., "1 pill"
    },
    frequency: {
      type: String,
      required: true // e.g., "3x daily"
    },
    duration: String, // e.g., "7 days"
    instructions: String, // e.g., "After meals"
    quantityDispensed: {
      type: Number,
      default: 0
    }
  }],
  status: {
    type: String,
    enum: ['PENDING', 'PREPARING', 'READY', 'DISPENSED', 'CANCELLED'],
    default: 'PENDING'
  },
  pharmacist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dispensedAt: Date,
  isEmergency: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
