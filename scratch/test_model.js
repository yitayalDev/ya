const mongoose = require('mongoose');

try {
  const academicPolicySchema = mongoose.Schema({
    gradeThresholds: {
      type: Map,
      of: {
        minScore: Number,
        gpaPoint: Number,
      }
    }
  });
  const AcademicPolicy = mongoose.model('TestPolicy', academicPolicySchema);
  console.log('Model created successfully');
} catch (e) {
  console.error('Error creating model:', e);
}
