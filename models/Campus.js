const mongoose = require('mongoose');

const campusSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a campus name'],
      unique: true,
    },
    location: {
      type: String,
      required: [true, 'Please add a location'],
    },
    description: {
      type: String,
    },
    contactInfo: {
      phone: String,
      email: String,
      address: String,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    campusAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    dataIsolationMode: {
      type: String,
      enum: ['ISOLATED', 'UNIFIED'],
      default: 'UNIFIED',
    },
    establishedYear: Number,
    totalCapacity: Number, // Maximum number of students
    currentEnrollment: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Campus', campusSchema);
