/**
 * Grade calculation utilities
 */

const AcademicPolicy = require('../models/AcademicPolicy');

/**
 * Get effective academic policy for a context
 */
async function getEffectivePolicy(campus = null, college = null) {
  try {
    let policy = null;

    // Try college-specific first
    if (college) {
      policy = await AcademicPolicy.findOne({
        scope: 'COLLEGE',
        college,
        isActive: true,
      });
    }

    // Try campus-specific if no college policy
    if (!policy && campus) {
      policy = await AcademicPolicy.findOne({
        scope: 'CAMPUS',
        campus,
        isActive: true,
      });
    }

    // Fall back to global
    if (!policy) {
      policy = await AcademicPolicy.findOne({
        scope: 'GLOBAL',
        isActive: true,
      });
    }

    return policy;
  } catch (error) {
    console.error('Error fetching effective policy:', error);
    return null;
  }
}

/**
 * Convert numeric score to grade letter and GPA point based on policy scale
 * Uses the grade mapping from the academic policy
 */
function convertScoreToGrade(score, policy = null) {
  // Use policy thresholds if available, otherwise use defaults
  let thresholds = [];
  
  if (policy && policy.gpaSystem && policy.gpaSystem.gradeThresholds) {
    const mapping = policy.gpaSystem.gradeThresholds;
    
    // Handle both Mongoose Map and plain Object
    if (mapping instanceof Map) {
      for (let [grade, data] of mapping) {
        thresholds.push({ min: data.minScore, grade: grade, gpa: data.gpaPoint });
      }
    } else {
      for (let grade in mapping) {
        const data = mapping[grade];
        thresholds.push({ min: data.minScore, grade: grade, gpa: data.gpaPoint });
      }
    }
  } else {
    // Default 4.0 scale
    thresholds = [
      { min: 90, grade: 'A+', gpa: 4.0 },
      { min: 85, grade: 'A', gpa: 4.0 },
      { min: 80, grade: 'A-', gpa: 3.7 },
      { min: 75, grade: 'B+', gpa: 3.3 },
      { min: 70, grade: 'B', gpa: 3.0 },
      { min: 65, grade: 'B-', gpa: 2.7 },
      { min: 60, grade: 'C+', gpa: 2.3 },
      { min: 50, grade: 'C', gpa: 2.0 },
      { min: 40, grade: 'D', gpa: 1.0 },
      { min: 0, grade: 'F', gpa: 0.0 },
    ];
  }

  // Sort thresholds by min score descending
  thresholds.sort((a, b) => b.min - a.min);

  for (const threshold of thresholds) {
    if (score >= threshold.min) {
      return { gradeLetter: threshold.grade, gpaPoint: threshold.gpa };
    }
  }

  return { gradeLetter: 'F', gpaPoint: 0.0 };
}

/**
 * Calculate total weighted score from component scores
 * @param {Array} grades - Array of { component, score, weight }
 * @returns {Number} Total weighted score (0-100)
 */
/**
 * Calculate total weighted score from component scores
 * @param {Array} grades - Array of { component, score, weight, maxScore, name }
 * @param {Object} policy - Effective academic policy
 * @returns {Number} Total weighted score (0-100)
 */
function calculateTotalScore(grades, policy = null) {
  if (!grades || grades.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Get policy weights if available
  const policyWeights = policy?.gradingPolicy?.defaultWeights || null;

  for (const grade of grades) {
    let weight = grade.weight;
    
    // Override with policy weight if names match (case-insensitive)
    if (policyWeights && grade.name) {
      const normalizedName = grade.name.toLowerCase().replace(/\s+/g, '');
      
      // Map common names if they don't match exactly
      const policyKeyMap = {
        'finalexam': 'finalExam',
        'midexam': 'midExam',
        'quiz': 'quiz',
        'assignment': 'assignment',
        'project': 'project'
      };

      for (const [pKey, pWeight] of Object.entries(policyWeights)) {
        if (pKey.toLowerCase() === normalizedName || policyKeyMap[normalizedName] === pKey) {
          weight = pWeight;
          break;
        }
      }
    }

    if (grade.score != null && weight != null) {
      const maxScore = grade.maxScore || 100;
      // Normalization: (Actual Score / Max Possible) * Target Weight
      totalWeightedScore += (grade.score / maxScore) * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return parseFloat(totalWeightedScore.toFixed(1));
}

/**
 * Calculate GPA for a semester
 * GPA = Σ(Grade Point × Credit Hours) / Σ Credit Hours
 */
function calculateSemesterGPA(finalGrades, courses) {
  if (!finalGrades || finalGrades.length === 0) return 0;

  let totalPoints = 0;
  let totalCredits = 0;

  for (const fg of finalGrades) {
    const course = courses.find(c => c._id.equals(fg.course));
    const credits = course ? course.credits : 3;
    totalPoints += fg.gpaPoint * credits;
    totalCredits += credits;
  }

  if (totalCredits === 0) return 0;
  return totalPoints / totalCredits;
}

/**
 * Calculate cumulative GPA across all completed semesters
 */
function calculateCumulativeGPA(allFinalGrades, coursesMap) {
  if (!allFinalGrades || allFinalGrades.length === 0) return 0;

  let totalPoints = 0;
  let totalCredits = 0;

  for (const fg of allFinalGrades) {
    const course = coursesMap[fg.course.toString()];
    const credits = course ? course.credits : 3;
    // Only count passing grades for GPA? Typically D- and above count
    if (fg.gpaPoint > 0) {
      totalPoints += fg.gpaPoint * credits;
      totalCredits += credits;
    }
  }

  if (totalCredits === 0) return 0;
  return totalPoints / totalCredits;
}

/**
 * Validate that component weights for a course follow policy rules
 */
function validateComponentWeights(components, policy = null) {
  if (!components || components.length === 0) {
    return { isValid: false, message: 'No grading components defined' };
  }

  const totalWeight = components.reduce((sum, comp) => sum + comp.weight, 0);

  // Check if policy requires weights to sum to 100
  const require100 = policy?.gradingPolicy?.requireWeightSum100 ?? true;

  if (require100 && totalWeight !== 100) {
    return {
      isValid: false,
      message: `Total weight must equal 100%. Current total: ${totalWeight}%`,
      totalWeight,
    };
  }

  return { isValid: true, totalWeight };
}

/**
 * Check if grade is editable based on status
 */
function isGradeEditable(status) {
  // Only DRAFT and REJECTED statuses allow editing
  return ['DRAFT', 'REJECTED'].includes(status);
}

/**
 * Check if grade is submittable
 */
function isSubmittable(status) {
  return status === 'DRAFT';
}

/**
 * Check if grade is approvable by department
 */
function isDepartmentApprovable(status) {
  return status === 'SUBMITTED';
}

/**
 * Check if grade is registrar approvable
 */
function isRegistrarApprovable(status) {
  return status === 'DEPARTMENT_APPROVED';
}

/**
 * Check if grade is locked (final approval done)
 */
function isLocked(status) {
  return status === 'LOCKED' || status === 'APPROVED'; // APPROVED means final
}

/**
 * Calculate academic status based on GPA and attendance percentage
 */
function calculateAcademicStatus(gpa, attendancePercentage, policy = null) {
  if (!policy || !policy.academicStatusRules) {
    // Default logic
    if (gpa >= 2.0 && attendancePercentage >= 75) return 'Good Standing';
    if (gpa >= 1.5 && attendancePercentage >= 60) return 'Warning';
    if (gpa >= 1.0 && attendancePercentage >= 50) return 'Probation';
    return 'Dismissal';
  }

  const rules = policy.academicStatusRules;

  if (gpa >= rules.goodStanding.minGPA && attendancePercentage >= rules.goodStanding.minAttendance) {
    return 'Good Standing';
  }
  if (gpa >= rules.warning.minGPA && attendancePercentage >= rules.warning.minAttendance) {
    return 'Warning';
  }
  if (gpa >= rules.probation.minGPA && attendancePercentage >= rules.probation.minAttendance) {
    return 'Probation';
  }
  return 'Dismissal';
}

module.exports = {
  convertScoreToGrade,
  calculateTotalScore,
  getEffectivePolicy,
  calculateSemesterGPA,
  calculateCumulativeGPA,
  validateComponentWeights,
  calculateAcademicStatus,
  isGradeEditable,
  isSubmittable,
  isDepartmentApprovable,
  isRegistrarApprovable,
  isLocked,
};
