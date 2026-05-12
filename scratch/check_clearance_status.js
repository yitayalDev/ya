require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Clearance = require('../models/Clearance');

const checkClearance = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected...');

  const studentUser = await User.findOne({ email: 'cs.student3@test.edu' });
  if (!studentUser) {
    console.log('Student user not found');
    process.exit(0);
    return;
  }
  console.log('Student user ID:', studentUser._id);
  console.log('Student user name:', studentUser.name);
  console.log('Student user email:', studentUser.email);
  console.log('Student user role:', studentUser.role);

  const student = await Student.findOne({ userId: studentUser._id });
  if (!student) {
    console.log('\nNo student record found, creating...');
    const newStudent = await Student.create({
      _id: studentUser._id,
      userId: studentUser._id,
      studentId: 'CS2023003',
      name: studentUser.name,
      email: studentUser.email,
      department: 'Computer Science',
      academicYear: 'Year 4',
      enrollmentStatus: 'FULL_TIME'
    });
    console.log('Created student:', newStudent.studentId);
  } else {
    console.log('\nStudent record:');
    console.log('  studentId:', student.studentId);
    console.log('  name:', student.name);
    console.log('  department:', student.department);
    console.log('  academicYear:', student.academicYear);
  }

  const clearance = await Clearance.findOne({ studentId: studentUser._id }).sort('-createdAt');
  if (!clearance) {
    console.log('\nNo clearance record found');
    console.log('\nCreating a CLEARED clearance for testing...');
    const newClearance = await Clearance.create({
      studentId: studentUser._id,
      type: 'GRADUATION',
      status: 'CLEARED',
      steps: {
        library: { status: 'APPROVED', updatedAt: new Date() },
        department: { status: 'APPROVED', updatedAt: new Date() },
        proctor: { status: 'APPROVED', updatedAt: new Date() },
        dormitory: { status: 'APPROVED', updatedAt: new Date() },
        dean: { status: 'APPROVED', updatedAt: new Date() }
      }
    });
    console.log('Created clearance:', newClearance._id);
    console.log('Status:', newClearance.status);
  } else {
    console.log('\nClearance record:');
    console.log('  _id:', clearance._id);
    console.log('  status:', clearance.status);
    console.log('  type:', clearance.type);
  }

  process.exit(0);
};

checkClearance().catch(e => { console.error(e); process.exit(1); });
