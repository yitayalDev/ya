const mongoose = require('mongoose');
const Book = require('../models/Book');
const BookLoan = require('../models/BookLoan');
const BookReservation = require('../models/BookReservation');
const Library = require('../models/Library');
const Student = require('../models/Student');
const LibraryAttendance = require('../models/LibraryAttendance');
const { LibraryRoom, RoomBooking } = require('../models/LibraryRoom');
const DormBuilding = require('../models/DormBuilding');

// @desc    Get all books in a library
// @route   GET /api/library-ops/books/:libraryId
const getBooks = async (req, res) => {
  try {
    const books = await Book.find({ library: req.params.libraryId });
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search books (OPAC - Online Public Access Catalog)
// @route   GET /api/library-ops/books/search
const searchBooks = async (req, res) => {
  try {
    const { query, status, category } = req.query;
    
    let searchQuery = {};
    
    if (query) {
      searchQuery.$or = [
        { title: { $regex: query, $options: 'i' } },
        { author: { $regex: query, $options: 'i' } },
        { isbn: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
      ];
    }
    
    if (status) {
      searchQuery.status = status;
    }
    
    if (category) {
      searchQuery.category = category;
    }
    
    const books = await Book.find(searchQuery)
      .populate('library', 'name campus')
      .sort({ title: 1 });
    
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get book by ID
// @route   GET /api/library-ops/books/:libraryId

// @desc    Add a new book
// @route   POST /api/library-ops/books
const addBook = async (req, res) => {
  try {
    const book = await Book.create(req.body);
    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a book
// @route   PUT /api/library-ops/books/:id
const updateBook = async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Issue a book to a student
// @route   POST /api/library-ops/loans
const issueBook = async (req, res) => {
  const { bookId, studentId, dueDate, libraryId } = req.body;

  try {
    // 1. Find student (handle both Mongo ID and custom Student ID)
    let student;
    if (mongoose.Types.ObjectId.isValid(studentId)) {
      student = await Student.findById(studentId);
    }
    
    if (!student) {
      student = await Student.findOne({ 
        studentId: { $regex: new RegExp('^' + studentId + '$', 'i') } 
      });
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found. Please provide a valid Student ID or Database ID.' });
    }

    // 2. Check book availability
    const book = await Book.findById(bookId);
    if (!book || book.availableCopies <= 0) {
      return res.status(400).json({ message: 'Book not available for issuance' });
    }

    // 3. Create loan using student's MongoDB _id
    const loan = await BookLoan.create({
      book: bookId,
      student: student._id,
      library: libraryId,
      dueDate
    });

    // 4. Update book copies
    book.availableCopies -= 1;
    if (book.availableCopies === 0) book.status = 'OutOfStock';
    await book.save();

    // 5. ── RESET LIBRARY CLEARANCE if it was already approved ──────────────
    // If the student had their library clearance approved but now borrows a book,
    // reset it back to PENDING so they cannot pass clearance with unreturned books.
    try {
      const Clearance = require('../models/Clearance');
      const approvedClearance = await Clearance.findOne({
        student: student.user,          // Clearance stores the User _id
        status: 'IN_PROGRESS',
        'steps.library.status': 'APPROVED'
      });

      if (approvedClearance) {
        approvedClearance.steps.library.status = 'PENDING';
        approvedClearance.steps.library.remarks =
          `Clearance reset: student borrowed "${book.title}" after approval. Must return all books before re-approval.`;
        approvedClearance.steps.library.updatedAt = new Date();
        await approvedClearance.save();
      }
    } catch (resetErr) {
      // Non-critical — log but don't fail the issuance response
      console.error('Clearance reset error on book issue:', resetErr.message);
    }
    // ────────────────────────────────────────────────────────────────────────

    res.status(201).json(loan);
  } catch (error) {
    console.error('Error issuing book:', error);
    res.status(500).json({ message: error.message });
  }
};



const getLibraryLoans = async (req, res) => {
  try {
    const { studentId } = req.query;
    // Only show active loans (Issued / Overdue) — returned loans disappear automatically
    let query = {
      library: req.params.libraryId,
      status: { $ne: 'Returned' }
    };
    
    if (studentId) {
      // Find student by their custom studentId first
      const student = await Student.findOne({ 
        studentId: { $regex: new RegExp('^' + studentId + '$', 'i') } 
      });
      if (student) {
        query.student = student._id;
      } else if (mongoose.Types.ObjectId.isValid(studentId)) {
        // Fallback to mongo ID search
        query.student = studentId;
      } else {
        return res.json([]); // Student not found, return empty loans
      }
    }

    const loans = await BookLoan.find(query)
      .populate('book', 'title isbn')
      .populate({
        path: 'student',
        select: 'studentId department',
        populate: [
          { path: 'user', select: 'name email' },
          { path: 'department', select: 'name' }
        ]
      })
      .sort({ createdAt: -1 });
    
    // Manually populate building name and dorm info via DormBed hierarchy
    const DormBed = require('../models/DormBed');
    const populatedLoans = await Promise.all(loans.map(async (loan) => {
      const loanObj = loan.toObject();
      if (loanObj.student) {
        // Get Building Name AND Dorm info from DormBed → Room → Floor → Block → Building
        const bed = await DormBed.findOne({ student: loanObj.student._id })
          .populate({
            path: 'room',
            select: 'roomNumber',
            populate: { 
              path: 'floor', 
              select: 'floorNumber',
              populate: { 
                path: 'block', 
                select: 'name building',
                populate: { path: 'building', select: 'name' }
              }
            }
          });
        
        if (bed && bed.room) {
          const building = bed.room.floor?.block?.building;
          const blockName = bed.room.floor?.block?.name || '';
          // Building name from DormBuilding
          loanObj.student.buildingName = building?.name || blockName || 'N/A';
          // Dorm info: "BlockName - RoomNumber"
          loanObj.student.dormInfo = `${blockName} - ${bed.room.roomNumber}`;
        } else {
          loanObj.student.buildingName = 'No Dorm';
          loanObj.student.dormInfo = 'Unassigned';
        }
      }
      return loanObj;
    }));

    res.json(populatedLoans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reserve a book
// @route   POST /api/library-ops/reservations
const reserveBook = async (req, res) => {
  try {
    const { bookId } = req.body;
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    const studentId = student._id;
    
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    
    if (book.availableCopies > 0) {
      return res.status(400).json({ message: 'Book is available, no need to reserve' });
    }
    
    const existingReservation = await BookReservation.findOne({
      book: bookId,
      student: studentId,
      status: { $in: ['Pending', 'Ready'] }
    });
    
    if (existingReservation) {
      return res.status(400).json({ message: 'You already have a reservation for this book' });
    }
    
    const reservation = await BookReservation.create({
      book: bookId,
      student: studentId,
      library: book.library,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    });
    
    res.status(201).json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get my reservations
// @route   GET /api/library-ops/reservations/my
const getMyReservations = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    const studentId = student._id;
    const reservations = await BookReservation.find({ student: studentId })
      .populate('book', 'title author isbn availableCopies totalCopies')
      .populate('library', 'name')
      .sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel reservation
// @route   DELETE /api/library-ops/reservations/:id
const cancelReservation = async (req, res) => {
  try {
    const reservation = await BookReservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: 'Reservation not found' });
    
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    
    if (reservation.student.toString() !== student._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    reservation.status = 'Cancelled';
    await reservation.save();
    res.json({ message: 'Reservation cancelled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get reservations for a library
// @route   GET /api/library-ops/reservations/:libraryId
const getLibraryReservations = async (req, res) => {
  try {
    const reservations = await BookReservation.find({ library: req.params.libraryId })
      .populate('book', 'title author')
      .populate({
        path: 'student',
        select: 'studentId department',
        populate: [
          { path: 'user', select: 'name assignedBuilding' },
          { path: 'department', select: 'name' }
        ]
      })
      .sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Process return and notify next reservation
// @route   POST /api/library-ops/loans/:id/return
const returnBook = async (req, res) => {
  try {
    const loan = await BookLoan.findById(req.params.id);
    if (!loan || loan.status === 'Returned') {
      return res.status(400).json({ message: 'Invalid loan record' });
    }

    loan.returnDate = new Date();
    loan.status = 'Returned';
    await loan.save();

    const book = await Book.findById(loan.book);
    book.availableCopies += 1;
    book.status = 'Available';
    await book.save();

    const nextReservation = await BookReservation.findOne({
      book: loan.book,
      status: 'Pending'
    }).sort({ createdAt: 1 });

    if (nextReservation) {
      nextReservation.status = 'Ready';
      nextReservation.notifiedAt = new Date();
      await nextReservation.save();

      // Trigger Notification
      const { createNotification } = require('./notificationController');
      const studentProfile = await Student.findById(nextReservation.student);
      if (studentProfile) {
        await createNotification({
          recipient: studentProfile.user,
          title: 'Book Ready for Pickup!',
          message: `The book "${book.title}" you reserved is now available. Please pick it up within 3 days.`,
          type: 'LIBRARY',
          priority: 'HIGH',
          relatedId: nextReservation._id
        });
      }
    }

    // ── AUTO-APPROVE LIBRARY CLEARANCE ──────────────────────────────────────
    // After this return, check if the student still has any active loans.
    // If no active loans remain, automatically approve their library clearance step.
    try {
      const remainingLoans = await BookLoan.countDocuments({
        student: loan.student,
        status: { $ne: 'Returned' }
      });

      if (remainingLoans === 0) {
        const Clearance = require('../models/Clearance');
        const pendingClearance = await Clearance.findOne({
          student: { $exists: true },
          status: 'IN_PROGRESS',
          'steps.library.status': 'PENDING'
        }).where('student').equals(
          // clearance.student is the User ObjectId; map from Student → User
          await Student.findById(loan.student).then(s => s?.user)
        );

        if (pendingClearance) {
          pendingClearance.steps.library.status = 'APPROVED';
          pendingClearance.steps.library.remarks =
            'Auto-approved: All borrowed books have been returned.';
          pendingClearance.steps.library.updatedAt = new Date();
          await pendingClearance.save();
        }
      }
    } catch (autoApproveErr) {
      // Non-critical: log but don't fail the return response
      console.error('Library clearance auto-approve error:', autoApproveErr.message);
    }
    // ────────────────────────────────────────────────────────────────────────

    res.json(loan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get rooms for a library
// @route   GET /api/library-ops/rooms/:libraryId
const getLibraryRooms = async (req, res) => {
  try {
    const rooms = await LibraryRoom.find({ library: req.params.libraryId, isActive: true });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a room/desk
// @route   POST /api/library-ops/rooms
const addLibraryRoom = async (req, res) => {
  try {
    const room = await LibraryRoom.create(req.body);
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get available time slots
// @route   GET /api/library-ops/rooms/:roomId/available
const getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.query;
    const bookings = await RoomBooking.find({
      room: req.params.roomId,
      date: new Date(date),
      status: { $ne: 'Cancelled' }
    });
    
    const { duration } = req.query;
    const slotDuration = parseInt(duration) || 2;
    const maxDuration = 4;
    
    const slots = [];
    const startHour = 8;
    const endHour = 22;
    
    for (let hour = startHour; hour <= endHour - slotDuration; hour++) {
      for (let d = slotDuration; d <= maxDuration; d += slotDuration) {
        if (hour + d <= endHour) {
          const startTime = `${hour.toString().padStart(2, '0')}:00`;
          const endTime = `${(hour + d).toString().padStart(2, '0')}:00`;
          
          let isBooked = false;
          for (let bHour = hour; bHour < hour + d; bHour++) {
            const checkStart = `${bHour.toString().padStart(2, '0')}:00`;
            const checkEnd = `${(bHour + 1).toString().padStart(2, '0')}:00`;
            if (bookings.some(b => b.startTime === checkStart && b.endTime === checkEnd)) {
              isBooked = true;
              break;
            }
          }
          
          if (!isBooked) {
            slots.push({ startTime, endTime, duration: d });
          }
        }
      }
    }
    
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Book a room/desk
// @route   POST /api/library-ops/bookings
const bookRoom = async (req, res) => {
  try {
    const { roomId, date, startTime, endTime } = req.body;
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    const studentId = student._id;
    
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const checkStart = `${hour.toString().padStart(2, '0')}:00`;
      const checkEnd = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      const existingBooking = await RoomBooking.findOne({
        room: roomId,
        date: new Date(date),
        startTime: checkStart,
        status: { $ne: 'Cancelled' }
      });
      
      if (existingBooking) {
        return res.status(400).json({ message: `Time slot ${checkStart} - ${checkEnd} is already booked` });
      }
    }
    
    const room = await LibraryRoom.findById(roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    const booking = await RoomBooking.create({
      room: roomId,
      student: studentId,
      library: room.library,
      date,
      startTime,
      endTime
    });
    
    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get my bookings
// @route   GET /api/library-ops/bookings/my
const getMyRoomBookings = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    const studentId = student._id;
    const bookings = await RoomBooking.find({ student: studentId })
      .populate('room', 'name type capacity location')
      .sort({ date: -1, startTime: 1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel booking
// @route   DELETE /api/library-ops/bookings/:id
const cancelRoomBooking = async (req, res) => {
  try {
    const booking = await RoomBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    
    if (booking.student.toString() !== student._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    booking.status = 'Cancelled';
    await booking.save();
    res.json({ message: 'Booking cancelled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get library bookings
// @route   GET /api/library-ops/bookings/:libraryId
const getLibraryRoomBookings = async (req, res) => {
  try {
    const bookings = await RoomBooking.find({ library: req.params.libraryId })
      .populate('room', 'name type')
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name' }
      })
      .sort({ date: -1, startTime: 1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current library occupancy
// @route   GET /api/library-ops/occupancy/:libraryId
const getLibraryOccupancy = async (req, res) => {
  try {
    const library = await Library.findById(req.params.libraryId);
    if (!library) return res.status(404).json({ message: 'Library not found' });

    const count = await LibraryAttendance.countDocuments({ 
      library: req.params.libraryId, 
      status: 'INSIDE' 
    });
    
    const insideStudents = await LibraryAttendance.find({ 
      library: req.params.libraryId, 
      status: 'INSIDE' 
    }).populate({
      path: 'student',
      select: 'studentId department',
      populate: [
        { path: 'user', select: 'name assignedBuilding' },
        { path: 'department', select: 'name' }
      ]
    });

    // Manually populate the building name for occupancy students as well
    const populatedStudents = await Promise.all(insideStudents.map(async (visit) => {
      const visitObj = visit.toObject();
      if (visitObj.student && visitObj.student.user && visitObj.student.user.assignedBuilding) {
        const building = await require('../models/DormBuilding').findById(visitObj.student.user.assignedBuilding).select('name');
        visitObj.student.user.assignedBuilding = building;
      }
      return visitObj;
    }));

    res.json({ 
      count, 
      capacity: library.capacity,
      isFull: count >= library.capacity,
      students: populatedStudents 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle library attendance (Check-In/Check-Out)
// @route   POST /api/library-ops/attendance/scan
const toggleLibraryAttendance = async (req, res) => {
  const { studentId, libraryId } = req.body;

  try {
    // 1. Check if student exists
    const student = await Student.findOne({ _id: studentId });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // 2. Look for an active "INSIDE" record
    const activeVisit = await LibraryAttendance.findOne({
      student: studentId,
      library: libraryId,
      status: 'INSIDE'
    });

    if (activeVisit) {
      // CHECK-OUT
      activeVisit.checkOut = new Date();
      activeVisit.status = 'OUT';
      await activeVisit.save();
      return res.json({ message: 'Check-Out Successful', status: 'OUT', student: student.studentId });
    } else {
      // CHECK-IN
      const newVisit = await LibraryAttendance.create({
        student: studentId,
        library: libraryId,
        status: 'INSIDE'
      });
      return res.status(201).json({ message: 'Check-In Successful', status: 'INSIDE', student: student.studentId });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Student self-scan library attendance
// @route   POST /api/library-ops/attendance/student-scan
const studentToggleLibraryAttendance = async (req, res) => {
  const { libraryId } = req.body;
  const studentUserId = req.user._id;

  try {
    // 1. Find student profile from user ID
    const student = await Student.findOne({ user: studentUserId });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    // 2. Look for active visit
    const activeVisit = await LibraryAttendance.findOne({
      student: student._id,
      library: libraryId,
      status: 'INSIDE'
    });

    if (activeVisit) {
      activeVisit.checkOut = new Date();
      activeVisit.status = 'OUT';
      await activeVisit.save();
      return res.json({ message: 'Checked out of Library successfully', status: 'OUT' });
    } else {
      await LibraryAttendance.create({
        student: student._id,
        library: libraryId,
        status: 'INSIDE'
      });
      return res.status(201).json({ message: 'Checked into Library successfully', status: 'INSIDE' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get active library visits (for live attendance list)
// @route   GET /api/library-ops/attendance/active/:libraryId
const getActiveLibraryVisits = async (req, res) => {
  try {
    const visits = await LibraryAttendance.find({
      library: req.params.libraryId,
      status: 'INSIDE'
    }).populate({
      path: 'student',
      select: 'studentId department',
      populate: [
        { path: 'user', select: 'name assignedBuilding' },
        { path: 'department', select: 'name' }
      ]
    }).sort({ checkIn: -1 });

    // Populate building names
    const populatedVisits = await Promise.all(visits.map(async (visit) => {
      const visitObj = visit.toObject();
      if (visitObj.student && visitObj.student.user && visitObj.student.user.assignedBuilding) {
        const building = await require('../models/DormBuilding').findById(visitObj.student.user.assignedBuilding).select('name');
        visitObj.student.user.assignedBuilding = building;
      }
      return visitObj;
    }));

    res.json(populatedVisits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get AI-driven book recommendations
// @route   GET /api/library-ops/recommendations
const getRecommendedBooks = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).populate('department');
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    // 1. Get student's previous loans to understand their interests
    const previousLoans = await BookLoan.find({ student: student._id }).populate('book');
    const borrowedCategories = previousLoans.map(l => l.book.category);
    
    // 2. Build Recommendation Query
    // Priority: 
    // a) Books in their department/major
    // b) Books in categories they previously borrowed
    // c) Popular books in the library
    
    let recommendationFilter = {
      availableCopies: { $gt: 0 },
      status: 'Available'
    };

    if (student.department) {
      // Look for books that might match their major (using regex for flexibility)
      const major = student.department.name.toLowerCase();
      recommendationFilter.$or = [
        { category: { $regex: major, $options: 'i' } },
        { title: { $regex: major, $options: 'i' } }
      ];
    }

    if (borrowedCategories.length > 0) {
      if (!recommendationFilter.$or) recommendationFilter.$or = [];
      recommendationFilter.$or.push({ category: { $in: borrowedCategories } });
    }

    const recommendations = await Book.find(recommendationFilter)
      .limit(10)
      .populate('library', 'name');

    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all libraries
// @route   GET /api/library-ops/libraries
const getLibraries = async (req, res) => {
  try {
    const libraries = await Library.find()
      .populate('campus', 'name')
      .populate('libraryAdmin', 'name email');
    res.json(libraries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBooks,
  searchBooks,
  addBook,
  updateBook,
  issueBook,
  returnBook,
  getLibraryLoans,
  getLibraryOccupancy,
  toggleLibraryAttendance,
  studentToggleLibraryAttendance,
  reserveBook,
  getMyReservations,
  cancelReservation,
  getLibraryReservations,
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
};
