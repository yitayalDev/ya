const mongoose = require('mongoose');
const GradeAuditLog = require('../models/GradeAuditLog');
const dotenv = require('dotenv');
dotenv.config();

const checkAudit = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/university_app');
    console.log('DB Connected');
    
    const logs = await GradeAuditLog.find().sort({ createdAt: -1 }).limit(10);
    console.log(`Found ${logs.length} audit logs`);
    
    logs.forEach(l => {
      console.log(`Action: ${l.action}, Student: ${l.student}, Old: ${l.oldValue}, New: ${l.newValue}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkAudit();
