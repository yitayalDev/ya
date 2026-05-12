const calculateTotalScore = (grades) => {
  if (!grades || grades.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const grade of grades) {
    if (grade.score != null && grade.weight != null) {
      const maxScore = grade.maxScore || 100;
      totalWeightedScore += (grade.score / maxScore) * grade.weight;
      totalWeight += grade.weight;
    }
  }

  if (totalWeight === 0) return 0;

  return totalWeightedScore;
};

const testData = [
  { score: 10, weight: 20, maxScore: 20 },
  { score: 15, weight: 20, maxScore: 20 },
  { score: 23, weight: 30, maxScore: 30 },
  { score: 24, weight: 30, maxScore: 30 }
];

console.log('Result:', calculateTotalScore(testData));
