const mongoose = require('mongoose');

const staffSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a staff name'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
    },
    staffId: {
      type: String,
      required: [true, 'Please add a staff ID'],
      unique: true,
    },
    college: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'College',
    },
    designation: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Staff', staffSchema);
