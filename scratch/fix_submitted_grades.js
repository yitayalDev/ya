const mongoose = require('mongoose');
const GradingComponent = require('../models/GradingComponent');
const Grade = require('../models/Grade');
const FinalGrade = require('../models/FinalGrade');
const AcademicPolicy = require('../models/AcademicPolicy');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Section = require('../models/Section');
const { Semester } = require('../models/AcademicCalendar');
const { calculateTotalScore, convertScoreToGrade, getEffectivePolicy } = require('../utils/gradeCalculator');
const dotenv = require('dotenv');
dotenv.config();

const fixSubmittedGrades = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/university_app');
    console.log('DB Connected');
    
    const submittedGrades = await FinalGrade.find({ status: 'SUBMITTED' }).populate('course');
    console.log(`Found ${submittedGrades.length} SUBMITTED final grades to fix`);
    
    for (const fg of submittedGrades) {
      const studentGrades = await Grade.find({
        student: fg.student,
        course: fg.course._id,
        section: fg.section,
      }).populate('component');
      
      const gradeData = studentGrades
        .filter(g => g.component != null)
        .map((g) => ({
          score: g.score,
          weight: g.component.weight,
          maxScore: g.component.maxScore,
        }));
        
      const totalScore = calculateTotalScore(gradeData);
      
      // Get policy
      const policy = await getEffectivePolicy(null, fg.course.college);
      const { gradeLetter, gpaPoint } = convertScoreToGrade(totalScore, policy);
      
      console.log(`Updating student ${fg.student}: ${fg.totalScore} -> ${totalScore} (${gradeLetter})`);
      
      fg.totalScore = totalScore;
      fg.gradeLetter = gradeLetter;
      fg.gpaPoint = gpaPoint;
      await fg.save();
    }
    
    console.log('Fix complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fixSubmittedGrades();
