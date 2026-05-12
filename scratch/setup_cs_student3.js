const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Student = require('../models/Student');
const Clearance = require('../models/Clearance');
const Department = require('../models/Department');
const College = require('../models/College');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const college = await College.findOne();
  const department = await Department.findOne();
  
  let csStudent3 = await Student.findOne({ studentId: 'CS2023003' });
  if (!csStudent3) {
    csStudent3 = await Student.create({
      _id: '69ef44dbb6c607eaeb7d7ba9',
      user: '69ef44dbb6c607eaeb7d7ba9',
      studentId: 'CS2023003',
      phone: '+1234567890',
      gender: 'Other',
      dateOfBirth: new Date('2000-01-01'),
      college: college._id,
      department: department._id,
      academicYear: 'Year 4',
      admissionYear: 2020,
      status: 'Active',
      academicStatus: 'Good Standing',
      campus: college._id,
    });
    console.log('Created student:', csStudent3.studentId);
  } else {
    console.log('Student already exists:', csStudent3.studentId);
  }

  const clearance = await Clearance.findOne({ student: csStudent3._id });
  if (!clearance) {
    console.log('\nCreating CLEARED clearance for CS2023003...');
    const newClearance = await Clearance.create({
      student: csStudent3._id,
      type: 'GRADUATION',
      status: 'CLEARED',
      steps: {
        library: { status: 'APPROVED', updatedAt: new Date(), autoChecked: true },
        department: { status: 'APPROVED', updatedAt: new Date(), gradesCompleted: true, academicCompleted: true },
        proctor: { status: 'APPROVED', updatedAt: new Date(), identityVerified: true, academicFollowup: true, behaviorClean: true },
        dormitory: { status: 'APPROVED', updatedAt: new Date(), roomVacated: true, noDamage: true, keyReturned: true },
        dean: { status: 'APPROVED', updatedAt: new Date(), noSeriousDiscipline: true }
      }
    });
    console.log('Clearance created:', newClearance._id, '- Status:', newClearance.status);
  } else {
    console.log('\nClearance exists:', clearance._id, '- Status:', clearance.status);
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
