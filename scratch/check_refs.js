const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Department = require('../models/Department');
const College = require('../models/College');
const User = require('../models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const college = await College.findOne();
  const department = await Department.findOne();
  console.log('College:', college ? college._id : 'none');
  console.log('Department:', department ? department._id : 'none');
  const users = await User.find({role: 'STUDENT'});
  console.log('Students:', users.length);
  users.forEach(u => console.log('  -', u.email, u._id));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
