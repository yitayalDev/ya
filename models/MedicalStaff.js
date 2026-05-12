const mongoose = require('mongoose');

const medicalStaffSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  role: {
    type: String,
    enum: ['DOCTOR', 'PHARMACIST', 'NURSE', 'CLINIC_ADMIN'],
    required: true
  },
  specialization: String,
  isAvailable: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('MedicalStaff', medicalStaffSchema);
