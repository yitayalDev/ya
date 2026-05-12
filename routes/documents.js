const express = require('express');
const router = express.Router();
const {
    generateEnrollmentCert,
    generateGoodStandingLetter
} = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('REGISTRAR', 'SUPER_ADMIN'));

router.get('/enrollment-cert/:studentId', generateEnrollmentCert);
router.get('/good-standing/:studentId', generateGoodStandingLetter);

module.exports = router;
