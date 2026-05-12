const { calculateTotalScore, convertScoreToGrade } = require('../../utils/gradeCalculator');

describe('Grading Functional Rules', () => {
  const mockPolicy = {
    gpaSystem: {
      gradeThresholds: {
        'A+': { minScore: 90, gpaPoint: 4.0 },
        'A': { minScore: 85, gpaPoint: 4.0 },
        'B': { minScore: 70, gpaPoint: 3.0 },
        'C': { minScore: 50, gpaPoint: 2.0 },
        'F': { minScore: 0, gpaPoint: 0.0 }
      }
    }
  };

  describe('Score Calculation (25% + 75% Rule)', () => {
    it('should calculate total score correctly based on component weights', () => {
      const grades = [
        { name: 'Mid Exam', score: 20, maxScore: 25, weight: 25 },
        { name: 'Final Exam', score: 60, maxScore: 75, weight: 75 }
      ];

      // (20/25)*25 = 20
      // (60/75)*75 = 60
      // Total = 80
      const total = calculateTotalScore(grades, mockPolicy);
      expect(total).toBe(80.0);
    });

    it('should handle normalization for different max scores', () => {
      const grades = [
        { name: 'Quiz', score: 8, maxScore: 10, weight: 10 },
        { name: 'Final', score: 40, maxScore: 50, weight: 90 }
      ];

      // (8/10)*10 = 8
      // (40/50)*90 = 72
      // Total = 80
      const total = calculateTotalScore(grades, mockPolicy);
      expect(total).toBe(80.0);
    });
  });

  describe('Grade Conversion (Policy Thresholds)', () => {
    it('should assign A+ for scores >= 90', () => {
      const result = convertScoreToGrade(92, mockPolicy);
      expect(result.gradeLetter).toBe('A+');
      expect(result.gpaPoint).toBe(4.0);
    });

    it('should assign B for scores between 70 and 84', () => {
      const result = convertScoreToGrade(75, mockPolicy);
      expect(result.gradeLetter).toBe('B');
      expect(result.gpaPoint).toBe(3.0);
    });

    it('should assign F for scores below 50', () => {
      const result = convertScoreToGrade(45, mockPolicy);
      expect(result.gradeLetter).toBe('F');
      expect(result.gpaPoint).toBe(0.0);
    });
  });

  describe('Workflow Constraints', () => {
    const { isGradeEditable, isSubmittable } = require('../../utils/gradeCalculator');

    it('should only allow editing in DRAFT or REJECTED status', () => {
      expect(isGradeEditable('DRAFT')).toBe(true);
      expect(isGradeEditable('REJECTED')).toBe(true);
      expect(isGradeEditable('SUBMITTED')).toBe(false);
      expect(isGradeEditable('APPROVED')).toBe(false);
    });

    it('should only allow submission in DRAFT status', () => {
      expect(isSubmittable('DRAFT')).toBe(true);
      expect(isSubmittable('SUBMITTED')).toBe(false);
    });
  });
});
