const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const resetAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = require('../models/User');

    const newPassword = 'adminpassword123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    let admin = await User.findOne({ role: 'SUPER_ADMIN' });

    if (admin) {
      // Update existing admin with fresh hashed password (bypass pre-save to avoid double-hashing)
      await User.updateOne(
        { _id: admin._id },
        { $set: { password: hashedPassword, email: 'admin@university.com' } }
      );
      console.log('✅ Super Admin password reset successfully!');
      console.log('   Email:    admin@university.com');
      console.log('   Password: adminpassword123');
    } else {
      // Create fresh super admin
      await User.create({
        name: 'Super Admin',
        email: 'admin@university.com',
        password: newPassword,
        role: 'SUPER_ADMIN',
      });
      console.log('✅ Super Admin created successfully!');
      console.log('   Email:    admin@university.com');
      console.log('   Password: adminpassword123');
    }

    process.exit();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

resetAdmin();
