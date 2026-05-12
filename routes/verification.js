const express = require('express');
const router = express.Router();
const { issueDocument, verifyDocument } = require('../controllers/verificationController');
const { protect, authorize } = require('../middleware/auth');

// Public route for verification
router.get('/:code', verifyDocument);

// Protected route for issuing documents
router.post('/issue', protect, authorize('REGISTRAR', 'SUPER_ADMIN', 'STUDENT'), issueDocument);

module.exports = router;
