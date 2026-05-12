const { calculateTotalScore } = require('../utils/gradeCalculator');

const testGrades = [
  { score: 10, weight: 10, maxScore: 10 },
  { score: 20, weight: 20, maxScore: 20 },
  { score: 15, weight: 20, maxScore: 20 },
  { score: 45, weight: 50, maxScore: 50 }
];

const result = calculateTotalScore(testGrades);
console.log('Test Calculation Result:', result);

if (result === 90) {
  console.log('SUCCESS: Calculation is correct (90/100)');
} else {
  console.log('FAILURE: Expected 90, got', result);
  process.exit(1);
}
