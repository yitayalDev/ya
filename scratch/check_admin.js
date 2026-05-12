const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config();

const checkUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/university_erp');
    console.log('DB Connected');
    
    const user = await User.findOne({ role: 'DEPARTMENT_ADMIN' });
    if (user) {
      console.log('User found:', {
        _id: user._id,
        name: user.name,
        role: user.role,
        college: user.college,
        department: user.department
      });
    } else {
      console.log('No DEPARTMENT_ADMIN found');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkUser();
