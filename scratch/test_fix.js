require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const studentProfile = await Student.findOne({ user: '69ef44dbb6c607eaeb7d7ba9' })
    .populate({
      path: 'user',
      select: 'name'
    })
    .select('studentId academicYear')
    .lean();
  
  const result = {
    name: studentProfile?.user?.name || studentProfile?.name,
    studentId: studentProfile?.studentId,
    academicYear: studentProfile?.academicYear
  };
  
  console.log('Result:');
  console.log(JSON.stringify(result, null, 2));
  
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
