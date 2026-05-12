const mongoose = require('mongoose');

const dormAttendanceSchema = mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['CHECK_IN', 'CHECK_OUT'],
      required: true,
    },
    gateId: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      default: 'QR',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DormAttendance', dormAttendanceSchema);
