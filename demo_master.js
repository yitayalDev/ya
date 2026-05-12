const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Campus = require('./models/Campus');
const College = require('./models/College');
const Department = require('./models/Department');
const DormBuilding = require('./models/DormBuilding');
const DormBlock = require('./models/DormBlock');
const DormRoom = require('./models/DormRoom');

dotenv.config();

const seedDemoUniverse = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Atlas for Demo Seeding...');

    // 1. Create Campus
    let campus = await Campus.findOne({ name: 'Main Campus' });
    if (!campus) {
      campus = await Campus.create({
        name: 'Main Campus',
        location: 'University City',
        description: 'The primary campus for all departments.'
      });
    }
    console.log('Campus Ready');

    // 2. Create College
    let college = await College.findOne({ name: 'College of Engineering' });
    if (!college) {
      college = await College.create({
        name: 'College of Engineering',
        campus: campus._id,
        description: 'Home of Innovation'
      });
    }
    console.log('College Ready');

    // 3. Create Department
    let dept = await Department.findOne({ name: 'Software Engineering' });
    if (!dept) {
      dept = await Department.create({
        name: 'Software Engineering',
        college: college._id,
        description: 'Building the future'
      });
    }
    console.log('Department Ready');

    // 4. Create Dormitory Structure
    let building = await DormBuilding.findOne({ name: 'Building A' });
    if (!building) {
      building = await DormBuilding.create({
        name: 'Building A',
        campus: campus._id,
        gender: 'MALE'
      });
    }

    let block = await DormBlock.findOne({ name: 'Block 1' });
    if (!block) {
      block = await DormBlock.create({
        name: 'Block 1',
        building: building._id
      });
    }

    let room = await DormRoom.findOne({ roomNumber: '101' });
    if (!room) {
      room = await DormRoom.create({
        roomNumber: '101',
        block: block._id,
        capacity: 4,
        type: 'STANDARD'
      });
    }
    console.log('Dormitory Ready');

    // 5. Create Demo Users for each role
    const roles = [
      'SUPER_ADMIN', 'STUDENT', 'INSTRUCTOR', 'DORMITORY_ADMIN', 
      'PROCTOR', 'CLINIC_ADMIN', 'LIBRARY_ADMIN', 'REGISTRAR'
    ];

    for (const role of roles) {
      const email = `demo_${role.toLowerCase()}@university.com`;
      let user = await User.findOne({ email });
      
      if (!user) {
        await User.create({
          name: `Demo ${role.replace('_', ' ')}`,
          email: email,
          password: 'demo12345',
          role: role,
          campus: campus._id,
          college: college._id,
          department: dept._id,
          assignedBuilding: building._id
        });
        console.log(`Created Demo User: ${role}`);
      }
    }

    console.log('--- DEMO UNIVERSE SEEDED SUCCESSFULLY ---');
    process.exit();
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
};

seedDemoUniverse();
