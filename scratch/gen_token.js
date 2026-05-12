const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const generateToken = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const user = await User.findOne({ role: 'SUPER_ADMIN' });
    if (!user) {
      console.log('No Super Admin found');
      process.exit(1);
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    console.log('TOKEN:' + token);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

generateToken();
