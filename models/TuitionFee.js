const mongoose = require('mongoose');

const tuitionFeeSchema = mongoose.Schema(
  {
    college: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    academicYear: {
      type: String, // e.g., "Year 1", "Year 2"
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TuitionFee', tuitionFeeSchema);
