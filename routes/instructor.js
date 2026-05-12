const express = require('express');
const router = express.Router();
const { getMySections } = require('../controllers/instructorController');
const { startAttendanceSession, endAttendanceSession, getSectionAttendanceSessions, getSessionAttendance } = require('../controllers/academicAttendanceController');
const { upload, uploadMaterial, getInstructorMaterials, updateMaterial, replaceMaterialFile, deleteMaterial } = require('../controllers/materialController');
const { protect, authorize } = require('../middleware/auth');

router.get('/my-sections', protect, authorize('INSTRUCTOR'), getMySections);

// Attendance routes
router.post('/attendance/start', protect, authorize('INSTRUCTOR'), startAttendanceSession);
router.post('/attendance/end/:sessionId', protect, authorize('INSTRUCTOR'), endAttendanceSession);
router.get('/attendance/section/:sectionId', protect, authorize('INSTRUCTOR'), getSectionAttendanceSessions);
router.get('/attendance/session/:sessionId', protect, authorize('INSTRUCTOR'), getSessionAttendance);

// Material routes - multer error handler wraps each route that uses upload
const multerErrorHandler = (err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 100MB.' });
  }
  if (err) {
    return res.status(400).json({ message: err.message || 'File upload error' });
  }
  next();
};

router.post('/materials/upload', protect, authorize('INSTRUCTOR'), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return multerErrorHandler(err, req, res, next);
    next();
  });
}, uploadMaterial);

router.get('/materials', protect, authorize('INSTRUCTOR'), getInstructorMaterials);
router.put('/materials/:id', protect, authorize('INSTRUCTOR'), updateMaterial);
router.put('/materials/:id/file', protect, authorize('INSTRUCTOR'), upload.single('file'), replaceMaterialFile);
router.delete('/materials/:id', protect, authorize('INSTRUCTOR'), deleteMaterial);

module.exports = router;
