const mongoose = require('mongoose');
const GradingComponent = require('../models/GradingComponent');
const Grade = require('../models/Grade');
const FinalGrade = require('../models/FinalGrade');
const dotenv = require('dotenv');
dotenv.config();

const checkGrades = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/university_app');
    console.log('DB Connected');
    
    const components = await GradingComponent.find();
    console.log(`Found ${components.length} components`);
    
    const grades = await Grade.find();
    console.log(`Found ${grades.length} individual grades`);
    
    const finalGrades = await FinalGrade.find({ status: 'SUBMITTED' });
    console.log(`Found ${finalGrades.length} SUBMITTED final grades`);
    
    if (finalGrades.length > 0) {
      console.log('Sample submitted grade:', {
        student: finalGrades[0].student,
        course: finalGrades[0].course,
        totalScore: finalGrades[0].totalScore,
        gradeLetter: finalGrades[0].gradeLetter
      });
      
      const studentGrades = await Grade.find({ student: finalGrades[0].student, course: finalGrades[0].course }).populate('component');
      console.log(`Found ${studentGrades.length} components graded for this student`);
      studentGrades.forEach(g => {
        console.log({
          score: g.score,
          componentName: g.component?.name,
          weight: g.component?.weight,
          maxScore: g.component?.maxScore
        });
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkGrades();
