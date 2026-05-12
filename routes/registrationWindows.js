const express = require('express');
const router = express.Router();
const {
  getRegistrationWindows,
  createRegistrationWindow,
  updateRegistrationWindow,
  deleteRegistrationWindow
} = require('../controllers/registrationWindowController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/:semesterId', getRegistrationWindows);
router.post('/', authorize('REGISTRAR', 'SUPER_ADMIN'), createRegistrationWindow);
router.put('/:id', authorize('REGISTRAR', 'SUPER_ADMIN'), updateRegistrationWindow);
router.delete('/:id', authorize('REGISTRAR', 'SUPER_ADMIN'), deleteRegistrationWindow);

module.exports = router;
