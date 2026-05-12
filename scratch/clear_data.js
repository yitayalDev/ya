const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const clearData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Models to clear
    const Section = mongoose.model('Section', require('../models/Section').schema);
    const Enrollment = mongoose.model('Enrollment', require('../models/Enrollment').schema);
    const Grade = mongoose.model('Grade', require('../models/Grade').schema);
    const FinalGrade = mongoose.model('FinalGrade', require('../models/FinalGrade').schema);
    const GradeAuditLog = mongoose.model('GradeAuditLog', require('../models/GradeAuditLog').schema);
    const GradingComponent = mongoose.model('GradingComponent', require('../models/GradingComponent').schema);
    const Attendance = mongoose.model('Attendance', require('../models/Attendance').schema);
    const AttendanceSession = mongoose.model('AttendanceSession', require('../models/AttendanceSession').schema);
    const Student = mongoose.model('Student', require('../models/Student').schema);
    const User = mongoose.model('User', require('../models/User').schema);

    console.log('Deleting Section documents...');
    await Section.deleteMany({});
    
    console.log('Deleting Enrollment documents...');
    await Enrollment.deleteMany({});
    
    console.log('Deleting Grade documents...');
    await Grade.deleteMany({});
    
    console.log('Deleting FinalGrade documents...');
    await FinalGrade.deleteMany({});
    
    console.log('Deleting GradeAuditLog documents...');
    await GradeAuditLog.deleteMany({});
    
    console.log('Deleting GradingComponent documents...');
    await GradingComponent.deleteMany({});
    
    console.log('Deleting Attendance documents...');
    await Attendance.deleteMany({});
    
    console.log('Deleting AttendanceSession documents...');
    await AttendanceSession.deleteMany({});

    console.log('Deleting Student documents...');
    await Student.deleteMany({});

    console.log('Deleting User documents with role STUDENT...');
    await User.deleteMany({ role: 'STUDENT' });

    console.log('Data cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing data:', error);
    process.exit(1);
  }
};

clearData();
