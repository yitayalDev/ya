const mongoose = require('mongoose');
const AcademicPolicy = require('../models/AcademicPolicy');
const User = require('../models/User');

const seedPolicy = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/erp_system');
    console.log('Connected to MongoDB');

    // Find any user to be the creator
    let admin = await User.findOne({ role: 'SUPER_ADMIN' });
    if (!admin) {
      admin = await User.findOne(); // Fallback to any user
    }
    
    if (!admin) {
      console.error('No users found in the system.');
      process.exit(1);
    }

    // Deactivate any existing global policies
    await AcademicPolicy.updateMany({ scope: 'GLOBAL' }, { isActive: false });

    const policyData = {
      name: 'Standard University Academic Policy 2026',
      description: 'Official academic policy defining grading scales, credit limits, and attendance requirements.',
      scope: 'GLOBAL',
      isActive: true,
      creditHourPolicy: {
        maxCreditsPerSemester: 21,
        minCreditsPerSemester: 12,
      },
      gpaSystem: {
        scale: '4.0',
        gradeThresholds: {
          'A+': { minScore: 85, gpaPoint: 4.0 },
          'A': { minScore: 80, gpaPoint: 4.0 },
          'A-': { minScore: 75, gpaPoint: 3.75 },
          'B+': { minScore: 70, gpaPoint: 3.5 },
          'B': { minScore: 65, gpaPoint: 3.0 },
          'B-': { minScore: 60, gpaPoint: 2.75 },
          'C+': { minScore: 50, gpaPoint: 2.5 },
          'C': { minScore: 40, gpaPoint: 2.0 },
          'D': { minScore: 30, gpaPoint: 1.0 },
          'F': { minScore: 0, gpaPoint: 0.0 },
        }
      },
      gradingPolicy: {
        requireWeightSum100: true,
      },
      attendancePolicy: {
        minimumAttendancePercentage: 75,
        markFailIfBelowThreshold: false,
        restrictFinalExam: true,
      },
      academicStatusRules: {
        goodStanding: { minGPA: 2.0, minAttendance: 75 },
        warning: { minGPA: 1.5, minAttendance: 60 },
        probation: { minGPA: 1.0, minAttendance: 50 },
        dismissal: { minGPA: 0.5, minAttendance: 30 },
      },
      createdBy: admin._id,
    };

    const policy = await AcademicPolicy.create(policyData);
    console.log('Successfully seeded Academic Policy:', policy.name);
    console.log('Grading Scale Applied: D (Pass) starts at 30%');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedPolicy();
