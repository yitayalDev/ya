require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Clearance = require('../models/Clearance');
const Student = require('../models/Student');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const clearance = await Clearance.findOne({ student: '69ef44dbb6c607eaeb7d7ba9' })
    .sort({ createdAt: -1 })
    .lean();

  console.log('Clearance raw:');
  console.log(JSON.stringify(clearance, null, 2));
  
  const studentProfile = await Student.findOne({ user: '69ef44dbb6c607eaeb7d7ba9' })
    .select('name studentId academicYear')
    .lean();
  
  console.log('\nStudent profile (as returned by getMyClearance):');
  console.log(JSON.stringify(studentProfile, null, 2));
  
  clearance.student = studentProfile;
  
  console.log('\nFull response (simulating /api/clearance/my):');
  console.log(JSON.stringify(clearance, null, 2));
  
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
