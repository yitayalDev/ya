const express = require('express');
const router = express.Router();
const {
  getBooks,
  searchBooks,
  addBook,
  updateBook,
  issueBook,
  returnBook,
  getLibraryLoans,
  reserveBook,
  getMyReservations,
  cancelReservation,
  getLibraryReservations,
  getLibraryOccupancy,
  toggleLibraryAttendance,
  studentToggleLibraryAttendance,
  getLibraryRooms,
  addLibraryRoom,
  getAvailableSlots,
  bookRoom,
  getMyRoomBookings,
  cancelRoomBooking,
  getLibraryRoomBookings,
  getRecommendedBooks,
  getLibraries,
  getActiveLibraryVisits
} = require('../controllers/libraryOperationController');
const {
  createLibrary,
  updateLibrary,
  assignLibraryAdmin,
  deleteLibrary
} = require('../controllers/libraryController');
const { protect, authorize } = require('../middleware/auth');

// Library management endpoints (used by frontend library_operation_service)
router.get('/libraries', protect, getLibraries);
router.post('/libraries', protect, authorize('SUPER_ADMIN'), createLibrary);
router.put('/libraries/:id', protect, authorize('SUPER_ADMIN'), updateLibrary);
router.delete('/libraries/:id', protect, authorize('SUPER_ADMIN'), deleteLibrary);
router.post('/libraries/:id/assign-admin', protect, authorize('SUPER_ADMIN'), assignLibraryAdmin);

// Book and reading operations
router.get('/recommendations', protect, authorize('STUDENT'), getRecommendedBooks);
router.get('/books/search', protect, authorize('STUDENT', 'LIBRARY_ADMIN', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), searchBooks);

// Reservations - Specific subpaths first
router.get('/reservations/library/:libraryId', protect, authorize('LIBRARY_ADMIN', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), (req, res, next) => {
  console.log(`Hit reservations/library/${req.params.libraryId}`);
  next();
}, getLibraryReservations);

router.post('/reservations', protect, authorize('STUDENT'), reserveBook);
router.get('/reservations/my', protect, authorize('STUDENT'), getMyReservations);
router.delete('/reservations/:id', protect, authorize('STUDENT'), cancelReservation);

// Bookings - Specific subpaths first
router.get('/bookings/library/:libraryId', protect, authorize('LIBRARY_ADMIN', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), (req, res, next) => {
  console.log(`Hit bookings/library/${req.params.libraryId}`);
  next();
}, getLibraryRoomBookings);

router.post('/bookings', protect, authorize('STUDENT'), bookRoom);
router.get('/bookings/my', protect, authorize('STUDENT'), getMyRoomBookings);
router.delete('/bookings/:id', protect, authorize('STUDENT'), cancelRoomBooking);

// General ID routes
router.get('/books/:libraryId', protect, authorize('LIBRARY_ADMIN', 'STUDENT', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), getBooks);
router.post('/books', protect, authorize('LIBRARY_ADMIN'), addBook);
router.put('/books/:id', protect, authorize('LIBRARY_ADMIN'), updateBook);
router.post('/loans', protect, authorize('LIBRARY_ADMIN'), issueBook);
router.post('/loans/:id/return', protect, authorize('LIBRARY_ADMIN'), returnBook);
router.get('/loans/:libraryId', protect, authorize('LIBRARY_ADMIN', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), getLibraryLoans);
router.get('/occupancy/:libraryId', protect, authorize('STUDENT', 'LIBRARY_ADMIN', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), getLibraryOccupancy);
router.post('/attendance/scan', protect, authorize('LIBRARY_ADMIN'), toggleLibraryAttendance);
router.post('/attendance/student-scan', protect, authorize('STUDENT'), studentToggleLibraryAttendance);
router.get('/attendance/active/:libraryId', protect, authorize('LIBRARY_ADMIN', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), getActiveLibraryVisits);

// Rooms
router.get('/rooms/:libraryId', protect, authorize('STUDENT', 'LIBRARY_ADMIN', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), getLibraryRooms);
router.post('/rooms', protect, authorize('LIBRARY_ADMIN'), addLibraryRoom);
router.get('/rooms/:roomId/available', protect, authorize('STUDENT'), getAvailableSlots);

module.exports = router;
