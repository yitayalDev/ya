const mongoose = require('mongoose');

const registrationWindowSchema = mongoose.Schema(
  {
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: true
    },
    academicYear: {
      type: String, // e.g. "Year 4", "Year 1", "All"
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('RegistrationWindow', registrationWindowSchema);
