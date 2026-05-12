const express = require('express');
const router = express.Router();
const {
  createBuilding,
  getBuildings,
  createBlock,
  getBlocks,
  createFloor,
  getFloors,
  createRoom,
  getRooms,
  getBeds,
  assignBed,
  transferStudent,
  getMyBed,
  createProctor,
  getProctors,
  updateProctor,
  deleteProctor,
  getBuildingOccupancy,
  getRecommendedRoommates,
  getUnassignedStudents,
  bulkAssignBeds,
  getDormStats,
  updateBuilding,
  deleteBuilding,
  updateFloor,
  deleteFloor,
  updateRoom,
  deleteRoom,
} = require('../controllers/housingController');
const {
  scanQR,
  getAttendanceStats,
  getCurfewAlerts,
} = require('../controllers/attendanceController');
const {
  getAllocationPreview,
  autoAllocate,
} = require('../controllers/allocationController');
const { protect, admin } = require('../middleware/auth');

router.route('/buildings').post(protect, createBuilding);
router.route('/buildings/campus/:campusId').get(protect, getBuildings);
router.route('/buildings/:id')
  .put(protect, updateBuilding)
  .delete(protect, deleteBuilding);

router.route('/blocks').post(protect, createBlock);
router.route('/blocks/building/:buildingId').get(protect, getBlocks);

router.route('/floors').post(protect, createFloor);
router.route('/floors/block/:blockId').get(protect, getFloors);
router.route('/floors/:id')
  .put(protect, updateFloor)
  .delete(protect, deleteFloor);

router.route('/rooms').post(protect, createRoom);
router.route('/rooms/floor/:floorId').get(protect, getRooms);
router.route('/rooms/:id')
  .put(protect, updateRoom)
  .delete(protect, deleteRoom);

router.route('/beds/:roomId').get(protect, getBeds);
router.route('/assign-bed').post(protect, assignBed);
router.route('/transfer').post(protect, transferStudent);
router.route('/my-bed').get(protect, getMyBed);
router.route('/roommate-recommendations').get(protect, getRecommendedRoommates);

router.route('/proctors').post(protect, admin, createProctor);
router.route('/proctors/:campusId').get(protect, getProctors);
router.route('/proctor/:id')
  .put(protect, admin, updateProctor)
  .delete(protect, admin, deleteProctor);
router.route('/stats/:campusId').get(protect, getDormStats);
router.route('/unassigned-students/:campusId').get(protect, getUnassignedStudents);
router.route('/bulk-assign').post(protect, bulkAssignBeds);
router.route('/building-occupancy/:buildingId').get(protect, getBuildingOccupancy);

router.route('/allocation-preview').post(protect, getAllocationPreview);
router.route('/auto-allocate').post(protect, autoAllocate);

// Attendance
router.route('/scan-qr').post(protect, scanQR);
router.route('/attendance-stats/:campusId').get(protect, getAttendanceStats);
router.route('/curfew-alerts/:campusId').get(protect, getCurfewAlerts);

module.exports = router;
