const { calculateTotalScore, convertScoreToGrade } = require('../utils/gradeCalculator');

// Mock policy based on what we found in DB
const mockPolicy = {
  gpaSystem: {
    gradeThresholds: {
      "A+": { "minScore": 90, "gpaPoint": 4 },
      "A": { "minScore": 85, "gpaPoint": 4 },
      "A-": { "minScore": 80, "gpaPoint": 3.75 },
      "B+": { "minScore": 75, "gpaPoint": 3.5 },
      "B": { "minScore": 70, "gpaPoint": 3 },
      "B-": { "minScore": 65, "gpaPoint": 2.7 },
      "C+": { "minScore": 60, "gpaPoint": 2.5 },
      "C": { "minScore": 50, "gpaPoint": 2 },
      "D": { "minScore": 40, "gpaPoint": 1 },
      "F": { "minScore": 0, "gpaPoint": 0 }
    }
  }
};

const testGrades = [
  { score: 10, weight: 10, maxScore: 10 },
  { score: 20, weight: 20, maxScore: 20 },
  { score: 15, weight: 20, maxScore: 20 },
  { score: 45, weight: 50, maxScore: 50 }
];

const totalScore = calculateTotalScore(testGrades);
console.log('Total Score:', totalScore);

const { gradeLetter, gpaPoint } = convertScoreToGrade(totalScore, mockPolicy);
console.log('Grade Letter:', gradeLetter);
console.log('GPA Point:', gpaPoint);

if (totalScore === 90 && gradeLetter === 'A+' && gpaPoint === 4) {
  console.log('SUCCESS: Calculation and Policy mapping are correct!');
} else {
  console.log('FAILURE: Results do not match academic policy expectations.');
  process.exit(1);
}
