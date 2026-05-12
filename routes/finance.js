const express = require('express');
const router = express.Router();
const { getFinancialOverview, setTuitionFee } = require('../controllers/financeController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.get('/overview', getFinancialOverview);
router.post('/fees', setTuitionFee);

module.exports = router;
