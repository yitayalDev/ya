require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const test = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected...');

  const studentUser = await User.findOne({ role: 'STUDENT' });
  if (studentUser) {
    console.log('Student Email:', studentUser.email);
    // Since we can't get the password, we might need to reset it or check if there's a default.
    // Usually, in these test setups, it's something like 'password123'
  } else {
    console.log('No student found');
  }

  process.exit(0);
};

test().catch(e => { console.error(e); process.exit(1); });
