const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { 
  registerStudent, 
  bulkUploadStudents, 
  getStudents, 
  promoteStudents, 
  getAtRiskStudents, 
  getDegreeAudit,
  getBulkClearanceAudit,
  exportBulkAudit,
  addSubstitution,
  getSubstitutions,
  updateMedicalProfile,
  updateDormitoryProfile,
  searchStudents,
  updateStudentStatus
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

router.patch('/:id/status', protect, authorize('REGISTRAR'), updateStudentStatus);
router.get('/search', protect, authorize('REGISTRAR'), searchStudents);
router.get('/at-risk', protect, authorize('REGISTRAR'), getAtRiskStudents);
router.get('/bulk-audit', protect, authorize('REGISTRAR'), getBulkClearanceAudit);
router.get('/bulk-audit/export', protect, authorize('REGISTRAR'), exportBulkAudit);
router.get('/:id/audit', protect, authorize('REGISTRAR', 'STUDENT'), getDegreeAudit);
router.put('/medical-profile', protect, authorize('STUDENT'), updateMedicalProfile);
router.put('/dormitory-profile', protect, authorize('STUDENT'), updateDormitoryProfile);
router.post('/', protect, authorize('REGISTRAR', 'SUPER_ADMIN'), registerStudent);
router.post('/bulk', protect, authorize('REGISTRAR'), upload.single('file'), bulkUploadStudents);
router.get('/', protect, authorize('REGISTRAR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'), getStudents);
router.put('/promote', protect, authorize('REGISTRAR'), promoteStudents);
router.post('/:id/substitutions', protect, authorize('REGISTRAR'), addSubstitution);
router.get('/:id/substitutions', protect, getSubstitutions);

module.exports = router;
