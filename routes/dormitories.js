const express = require('express');
const router = express.Router();
const {
  getDormitories,
  createDormitory,
  updateDormitory,
  deleteDormitory,
  getDormitoryByCampus,
} = require('../controllers/dormitoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN', 'STUDENT', 'PROCTOR'));

router.route('/')
  .get(getDormitories)
  .post(createDormitory);

router.route('/:id')
  .put(updateDormitory)
  .delete(authorize('SUPER_ADMIN'), deleteDormitory);

router.get('/campus/:campusId', getDormitoryByCampus);

module.exports = router;
