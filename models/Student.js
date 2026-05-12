const mongoose = require('mongoose');

const studentSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentId: {
      type: String,
      required: [true, 'Please add a student ID'],
      unique: true,
    },
    phone: String,
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },
    dateOfBirth: Date,
    college: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    academicProgram: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicProgram',
    },
    academicYear: {
      type: String, // e.g., "Year 1", "Year 2"
      required: true,
    },
    currentSemester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
    },
    admissionYear: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Suspended', 'Withdrawn', 'Dismissed', 'Graduated'],
      default: 'Active',
    },
    statusHistory: [
      {
        status: String,
        reason: String,
        date: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ],
    academicStatus: {
      type: String,
      enum: ['Good Standing', 'Warning', 'Probation', 'Dismissal'],
      default: 'Good Standing',
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
    },
    medicalProfile: {
      allergies: [String],
      chronicConditions: [String],
      bloodType: String,
      emergencyContact: {
        name: String,
        phone: String,
        relationship: String
      },
      labResults: [
        {
          testName: String,
          result: String,
          referenceRange: String,
          date: { type: Date, default: Date.now },
          status: { type: String, enum: ['PENDING', 'FINAL'], default: 'FINAL' },
          doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
        }
      ],
      vaccinations: [
        {
          vaccineName: String,
          date: { type: Date, default: Date.now },
          dose: String,
          provider: String,
          batchNumber: String
        }
      ],
      lastUpdated: Date
    },
    dormitoryProfile: {
      isSmoker: { type: Boolean, default: false },
      sleepHabit: { type: String, enum: ['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE'], default: 'FLEXIBLE' },
      studyHabit: { type: String, enum: ['QUIET', 'SOCIAL', 'FLEXIBLE'], default: 'FLEXIBLE' },
      interests: [String],
      preferredGender: { type: String, enum: ['MALE', 'FEMALE', 'NONE'], default: 'NONE' }
    },
    graduationDate: Date,
    degreeTitle: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Student', studentSchema);
