require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Student = require('../models/Student');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const studentProfile = await Student.findOne({ user: '69ef44dbb6c607eaeb7d7ba9' })
    .select('name studentId academicYear')
    .lean();
  
  console.log('StudentProfile result:');
  console.log(JSON.stringify(studentProfile, null, 2));
  
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
