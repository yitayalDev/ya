const express = require('express');
const router = express.Router();
const {
  getLibraries,
  createLibrary,
  updateLibrary,
  assignLibraryAdmin,
  getMyLibrary
} = require('../controllers/libraryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/my/assigned', authorize('LIBRARY_ADMIN', 'STUDENT'), getMyLibrary);

router.route('/')
  .get(authorize('SUPER_ADMIN'), getLibraries)
  .post(authorize('SUPER_ADMIN'), createLibrary);

router.route('/:id')
  .put(authorize('SUPER_ADMIN'), updateLibrary);

router.put('/:id/assign-admin', authorize('SUPER_ADMIN'), assignLibraryAdmin);

module.exports = router;
