const express = require('express');
const router = express.Router();
const {
  submitOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus
} = require('../controllers/transcriptOrderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/', authorize('STUDENT'), submitOrder);
router.get('/my', authorize('STUDENT'), getMyOrders);
router.get('/', authorize('REGISTRAR', 'SUPER_ADMIN'), getAllOrders);
router.put('/:id', authorize('REGISTRAR', 'SUPER_ADMIN'), updateOrderStatus);

module.exports = router;
