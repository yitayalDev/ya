const mongoose = require('mongoose');

const clearanceStepSchema = {
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  remarks: String,
  updatedAt: Date,
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
};

const clearanceSchema = mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['GRADUATION', 'WITHDRAWAL'],
      required: true
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'CLEARED', 'REJECTED'],
      default: 'IN_PROGRESS'
    },
    steps: {
      library: {
        ...clearanceStepSchema,
        autoChecked: { type: Boolean, default: true }
      },
      department: {
        ...clearanceStepSchema,
        gradesCompleted: { type: Boolean, default: false },
        academicCompleted: { type: Boolean, default: false }
      },
      proctor: {
        ...clearanceStepSchema,
        identityVerified: { type: Boolean, default: false },
        academicFollowup: { type: Boolean, default: false },
        behaviorClean: { type: Boolean, default: false }
      },
      dormitory: {
        ...clearanceStepSchema,
        roomVacated: { type: Boolean, default: false },
        noDamage: { type: Boolean, default: false },
        keyReturned: { type: Boolean, default: false }
      },
      dean: {
        ...clearanceStepSchema,
        noSeriousDiscipline: { type: Boolean, default: false }
      },
      registrar: {
        ...clearanceStepSchema,
        recordComplete: { type: Boolean, default: false }
      }
    },
    certificateUrl: String,
    clearedAt: Date
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Clearance', clearanceSchema);
