const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const {
    importStudents,
    exportStudents
} = require('../controllers/dataController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.post('/import/students', upload.single('file'), importStudents);
router.get('/export/students', exportStudents);

module.exports = router;
