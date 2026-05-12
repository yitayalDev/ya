const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const superAdminExists = await User.findOne({ role: 'SUPER_ADMIN' });

    if (!superAdminExists) {
      await User.create({
        name: 'Super Admin',
        email: 'admin@university.com',
        password: 'adminpassword123',
        role: 'SUPER_ADMIN',
      });
      console.log('Super Admin created successfully');
    } else {
      console.log('Super Admin already exists');
    }

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedSuperAdmin();
