const express = require('express');
const router = express.Router();
const {
    submitTransferRequest,
    getMyTransferRequests,
    getTransferRequests,
    processTransferRequest
} = require('../controllers/transferController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/my', authorize('STUDENT'), getMyTransferRequests);
router.post('/', authorize('STUDENT'), submitTransferRequest);
router.get('/', authorize('REGISTRAR', 'SUPER_ADMIN'), getTransferRequests);
router.put('/:id', authorize('REGISTRAR', 'SUPER_ADMIN'), processTransferRequest);

module.exports = router;
