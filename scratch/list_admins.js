const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config();

const listAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/university_app');
    console.log('DB Connected');
    
    const users = await User.find({ role: 'DEPARTMENT_ADMIN' });
    console.log(`Found ${users.length} DEPARTMENT_ADMINs:`);
    users.forEach(u => {
      console.log({
        email: u.email,
        college: u.college,
        department: u.department
      });
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

listAdmins();
