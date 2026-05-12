const mongoose = require('mongoose');
const dotenv = require('dotenv');
const AcademicPolicy = require('../models/AcademicPolicy');

dotenv.config();

const checkPolicies = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const policies = await AcademicPolicy.find({});
    console.log('Total policies found:', policies.length);

    policies.forEach((p, index) => {
      console.log(`\nPolicy ${index + 1}:`);
      console.log('Name:', p.name);
      console.log('Scope:', p.scope);
      console.log('Is Active:', p.isActive);
      console.log('GPA System Scale:', p.gpaSystem?.scale);
      console.log('Grade Thresholds:', JSON.stringify(p.gpaSystem?.gradeThresholds, null, 2));
    });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

checkPolicies();
