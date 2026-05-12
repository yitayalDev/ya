const mongoose = require('mongoose');

const gradeThresholdSchema = new mongoose.Schema({
  minScore: Number,
  gpaPoint: Number,
}, { _id: false });

const academicPolicySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Policy name is required'],
      unique: true,
    },
    description: {
      type: String,
    },
    scope: {
      type: String,
      enum: ['GLOBAL', 'CAMPUS', 'COLLEGE'],
      default: 'GLOBAL',
      required: true,
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
    },
    college: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Credit Hour Policy
    creditHourPolicy: {
      maxCreditsPerSemester: {
        type: Number,
        required: true,
        default: 21,
      },
      minCreditsPerSemester: {
        type: Number,
        required: true,
        default: 12,
      },
    },

    // GPA System Configuration
    gpaSystem: {
      scale: {
        type: String,
        enum: ['4.0', '5.0'],
        default: '4.0',
      },
      gradeMapping: {
        type: Map,
        of: Number,
        default: {
          'A+': 4.0,
          'A': 4.0,
          'A-': 3.75,
          'B+': 3.5,
          'B': 3.0,
          'B-': 2.7,
          'C+': 2.5,
          'C': 2.0,
          'D': 1.0,
          'F': 0.0,
        },
      },
      // New flexible threshold mapping: Grade -> { minScore, gpaPoint }
      gradeThresholds: {
        type: Map,
        of: gradeThresholdSchema,
        default: {
          'A+': { minScore: 90, gpaPoint: 4.0 },
          'A': { minScore: 85, gpaPoint: 4.0 },
          'A-': { minScore: 80, gpaPoint: 3.75 },
          'B+': { minScore: 75, gpaPoint: 3.5 },
          'B': { minScore: 70, gpaPoint: 3.0 },
          'B-': { minScore: 65, gpaPoint: 2.7 },
          'C+': { minScore: 60, gpaPoint: 2.5 },
          'C': { minScore: 50, gpaPoint: 2.0 },
          'D': { minScore: 40, gpaPoint: 1.0 },
          'F': { minScore: 0, gpaPoint: 0.0 },
        }
      },
      // For 5.0 scale, can be customized
      customGradeMapping: {
        type: Map,
        of: Number,
      },
    },

    // Grading Policy Rules (default weights)
    gradingPolicy: {
      defaultWeights: {
        type: Map,
        of: Number,
        default: {
          assignment: 20,
          quiz: 20,
          midExam: 30,
          finalExam: 30,
        }
      },
      requireWeightSum100: {
        type: Boolean,
        default: true,
      },
    },

    // Attendance Policy
    attendancePolicy: {
      minimumAttendancePercentage: {
        type: Number,
        required: true,
        default: 75,
        min: 0,
        max: 100,
      },
      markFailIfBelowThreshold: {
        type: Boolean,
        default: false,
      },
      restrictFinalExam: {
        type: Boolean,
        default: true,
      },
    },

    // Academic Status Rules
    academicStatusRules: {
      goodStanding: {
        minGPA: { type: Number, default: 2.0 },
        minAttendance: { type: Number, default: 75 },
      },
      warning: {
        minGPA: { type: Number, default: 1.5 },
        minAttendance: { type: Number, default: 60 },
      },
      probation: {
        minGPA: { type: Number, default: 1.0 },
        minAttendance: { type: Number, default: 50 },
      },
      dismissal: {
        minGPA: { type: Number, default: 0.5 },
        minAttendance: { type: Number, default: 30 },
      },
    },

    // Version control and audit
    version: {
      type: Number,
      default: 1,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one global policy is active
academicPolicySchema.index({ scope: 1, campus: 1, college: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

// Pre-save middleware to increment version
academicPolicySchema.pre('save', async function() {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }
});

module.exports = mongoose.model('AcademicPolicy', academicPolicySchema);