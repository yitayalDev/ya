const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true
  },
  campus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campus',
    required: true
  },
  clinicAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  contactPhone: String,
  operatingHours: {
    open: String,
    close: String,
    slotMinutes: {
      type: Number,
      default: 30
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Clinic', clinicSchema);
