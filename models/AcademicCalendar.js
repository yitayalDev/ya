const mongoose = require('mongoose');

// Academic Year Schema
const academicYearSchema = mongoose.Schema(
  {
    name: {
      type: String, // e.g., "2025/2026"
      required: [true, 'Academic year name is required'],
      unique: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Completed'],
      default: 'Inactive',
    },
    description: String,
  },
  {
    timestamps: true,
  }
);

// Semester Schema
const semesterSchema = mongoose.Schema(
  {
    name: {
      type: String, // e.g., "Semester 1", "Semester 2", "Summer"
      required: [true, 'Semester name is required'],
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic year is required'],
    },
    code: {
      type: String, // e.g., "2025-S1"
      unique: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: ['Upcoming', 'Active', 'Closed', 'Locked'],
      default: 'Upcoming',
    },
    registrationStart: Date,
    registrationEnd: Date,
    addDropDeadline: Date,
    examStart: Date,
    examEnd: Date,
    isCurrent: {
      type: Boolean,
      default: false,
    },
    description: String,
  },
  {
    timestamps: true,
  }
);

// Ensure only one semester is marked as current
semesterSchema.pre('save', async function () {
  if (this.isCurrent && this.status === 'Active') {
    await this.model('Semester').updateMany(
      { _id: { $ne: this._id } },
      { isCurrent: false }
    );
  }
});

// Auto-generate code
semesterSchema.pre('save', async function () {
  if (this.isNew && !this.code) {
    const academicYear = await mongoose.model('AcademicYear').findById(this.academicYear);
    if (academicYear) {
      const yearPrefix = academicYear.name.split('/')[0];
      this.code = `${yearPrefix}-${this.name.replace(/\s+/g, '').toUpperCase()}`;
    }
  }
});

// Legacy AcademicCalendar Schema (for backward compatibility)
const academicCalendarSchema = mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: true,
    },
    semesterName: {
      type: String,
      required: true,
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    registrationStart: Date,
    registrationEnd: Date,
    addDropDeadline: Date,
    examStart: Date,
    examEnd: Date,
  },
  {
    timestamps: true,
  }
);

const AcademicYear = mongoose.model('AcademicYear', academicYearSchema);
const Semester = mongoose.model('Semester', semesterSchema);
const AcademicCalendar = mongoose.model('AcademicCalendar', academicCalendarSchema);

module.exports = {
  AcademicYear,
  Semester,
  AcademicCalendar,
};
