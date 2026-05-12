const mongoose = require('mongoose');

const librarySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Library name is required'],
      unique: true,
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      required: [true, 'Campus is required'],
    },
    libraryAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
    },
    description: String,
    contactInfo: {
      phone: String,
      email: String,
    },
    totalBooks: {
      type: Number,
      default: 0,
    },
    capacity: {
      type: Number,
      default: 100,
    },
    operatingHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one library per campus
librarySchema.index({ campus: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('Library', librarySchema);
