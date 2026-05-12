const mongoose = require('mongoose');
const GradingComponent = require('../models/GradingComponent');
const Grade = require('../models/Grade');
const FinalGrade = require('../models/FinalGrade');
const dotenv = require('dotenv');
dotenv.config();

const checkGrades = async () => {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/university_app');
    console.log('DB Connected');
    
    const finalGrades = await FinalGrade.find({ status: 'SUBMITTED' });
    console.log(`Found ${finalGrades.length} SUBMITTED final grades`);
    
    for (const fg of finalGrades) {
      console.log('---');
      console.log('Final Grade:', {
        student: fg.student,
        course: fg.course,
        totalScore: fg.totalScore,
        gradeLetter: fg.gradeLetter
      });
      
      const studentGrades = await Grade.find({ student: fg.student, course: fg.course }).populate('component');
      console.log(`Individual grades found: ${studentGrades.length}`);
      studentGrades.forEach(g => {
        console.log(`  - ${g.component?.name || 'Unknown'}: score=${g.score}, section=${g.section}`);
      });
      console.log(`Expected section: ${fg.section}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

checkGrades();
