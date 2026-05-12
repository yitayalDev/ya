const mongoose = require('mongoose');

const dormitorySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Dormitory name is required'],
      unique: true,
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      required: [true, 'Campus is required'],
    },
    dormitoryAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
    },
    description: String,
    totalRooms: {
      type: Number,
      default: 0,
    },
    totalCapacity: {
      type: Number,
      default: 0,
    },
    currentOccupancy: {
      type: Number,
      default: 0,
    },
    genderType: {
      type: String,
      enum: ['MALE', 'FEMALE', 'MIXED'],
      default: 'MIXED',
    },
    contactInfo: {
      phone: String,
      email: String,
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

// Multiple dorms per campus is fine, so no unique index on campus
module.exports = mongoose.model('Dormitory', dormitorySchema);
