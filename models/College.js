const mongoose = require('mongoose');

const collegeSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a college name'],
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Campus',
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('College', collegeSchema);
