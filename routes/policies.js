const express = require('express');
const router = express.Router();
const {
  getPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getEffectivePolicy,
  activatePolicy,
} = require('../controllers/policyController');
const { protect, authorize } = require('../middleware/auth');

// GET /api/policies/effective - Get effective policy for context (public for authenticated users)
router.get('/effective', protect, getEffectivePolicy);

// PUT /api/policies/:id/activate - Activate a policy
router.put('/:id/activate', protect, authorize('SUPER_ADMIN', 'REGISTRAR'), activatePolicy);

// GET /api/policies - Get all policies
router.get('/', protect, authorize('SUPER_ADMIN', 'REGISTRAR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'LIBRARY_ADMIN', 'STUDENT'), getPolicies);

// GET /api/policies/:id - Get single policy
router.get('/:id', protect, authorize('SUPER_ADMIN', 'REGISTRAR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'LIBRARY_ADMIN', 'STUDENT'), getPolicy);

// POST /api/policies - Create new policy
router.post('/', protect, authorize('SUPER_ADMIN', 'REGISTRAR'), createPolicy);

// PUT /api/policies/:id - Update policy
router.put('/:id', protect, authorize('SUPER_ADMIN', 'REGISTRAR'), updatePolicy);

// DELETE /api/policies/:id - Deactivate policy
router.delete('/:id', protect, authorize('SUPER_ADMIN', 'REGISTRAR'), deletePolicy);

module.exports = router;