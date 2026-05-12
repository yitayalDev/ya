require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const bcrypt = require('bcryptjs');

const createStudent = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected...');

  const password = await bcrypt.hash('123456', 10);
  const user = await User.create({
    email: 'cs.student3@test.edu',
    password: password,
    role: 'STUDENT',
    name: 'CS Student 3'
  });

  const existing = await Student.findOne({ userId: user._id });
  if (!existing) {
    await Student.create({
      _id: user._id,
      userId: user._id,
      studentId: 'CS2023003',
      name: 'CS Student 3',
      email: 'cs.student3@test.edu',
      department: 'Computer Science',
      academicYear: 'Year 4',
      enrollmentStatus: 'FULL_TIME'
    });
  }

  console.log('Created student:');
  console.log('Email: cs.student3@test.edu');
  console.log('Password: 123456');
  console.log('Name: CS Student 3');
  console.log('User ID:', user._id);

  process.exit(0);
};

createStudent().catch(e => { console.error(e); process.exit(1); });
