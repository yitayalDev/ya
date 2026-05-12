const mongoose = require('mongoose');
const AcademicPolicy = require('../models/AcademicPolicy');
const dotenv = require('dotenv');
dotenv.config();

const checkPolicy = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/university_app');
    console.log('DB Connected');
    
    const policies = await AcademicPolicy.find();
    console.log(`Found ${policies.length} policies`);
    
    policies.forEach(p => {
      console.log(`Policy: ${p.name} (Scope: ${p.scope})`);
      console.log('Grade Thresholds:', JSON.stringify(p.gpaSystem?.gradeThresholds, null, 2));
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkPolicy();
