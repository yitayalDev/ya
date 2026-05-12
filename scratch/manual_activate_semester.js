const mongoose = require('mongoose');
const { Semester } = require('../models/AcademicCalendar');
const dotenv = require('dotenv');

dotenv.config();

const activateFirstSemester = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/university_app');
    console.log('Connected to MongoDB');

    const semester = await Semester.findOne({ 
      $or: [{ status: 'Upcoming' }, { status: 'Locked' }, { status: 'Closed' }] 
    });
    if (!semester) {
      console.log('No semester found to reset.');
      process.exit(0);
    }

    console.log(`Found semester: ${semester.name}. Attempting to activate...`);

    // Manual activation without transaction to test if transactions are the issue
    await Semester.updateMany({}, { isCurrent: false, status: 'Closed' }); // Close all others
    
    semester.status = 'Active';
    semester.isCurrent = true;
    await semester.save();

    console.log('Semester activated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error activating semester:', error);
    process.exit(1);
  }
};

activateFirstSemester();
