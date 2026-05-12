const DormBuilding = require('../models/DormBuilding');
const DormBlock = require('../models/DormBlock');
const DormFloor = require('../models/DormFloor');
const DormRoom = require('../models/DormRoom');
const DormBed = require('../models/DormBed');
const User = require('../models/User');
const DormRequest = require('../models/DormRequest');
const Student = require('../models/Student');

// @desc    Create a building
// @route   POST /api/housing/buildings
// @access  Private (Dormitory Admin)
const createBuilding = async (req, res) => {
  try {
    const { name, campusId } = req.body;
    const building = await DormBuilding.create({ name, campus: campusId });
    // Auto-create a Main block to bypass the block hierarchy in UI
    await DormBlock.create({ name: 'Main', building: building._id });
    res.status(201).json(building);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get buildings by campus
// @route   GET /api/housing/buildings/:campusId
const getBuildings = async (req, res) => {
  try {
    const buildings = await DormBuilding.find({ campus: req.params.campusId });
    res.json(buildings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a block
// @route   POST /api/housing/blocks
const createBlock = async (req, res) => {
  try {
    console.log('createBlock received body:', JSON.stringify(req.body));
    const { name, buildingId } = req.body;
    if (!buildingId) {
      return res.status(400).json({ message: 'buildingId is required', received: req.body });
    }
    const block = await DormBlock.create({ name, building: buildingId });
    res.status(201).json(block);
  } catch (error) {
    console.error('createBlock error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get blocks by building
// @route   GET /api/housing/blocks/:buildingId
const getBlocks = async (req, res) => {
  try {
    const blocks = await DormBlock.find({ building: req.params.buildingId });
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a floor
// @route   POST /api/housing/floors
const createFloor = async (req, res) => {
  try {
    const { floorNumber, blockId } = req.body;
    const floor = await DormFloor.create({ floorNumber, block: blockId });
    res.status(201).json(floor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get floors by block
// @route   GET /api/housing/floors/:blockId
const getFloors = async (req, res) => {
  try {
    const floors = await DormFloor.find({ block: req.params.blockId }).sort({ floorNumber: 1 });
    res.json(floors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a room and auto-generate beds
// @route   POST /api/housing/rooms
const createRoom = async (req, res) => {
  try {
    const { roomNumber, floorId, capacity, genderType } = req.body;
    
    const room = await DormRoom.create({ 
      roomNumber, 
      floor: floorId, 
      capacity, 
      genderType 
    });

    // Auto-generate beds
    const beds = [];
    for (let i = 1; i <= capacity; i++) {
      beds.push({
        bedNumber: `${roomNumber}-${i}`,
        room: room._id,
      });
    }
    await DormBed.insertMany(beds);

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get rooms by floor
// @route   GET /api/housing/rooms/:floorId
const getRooms = async (req, res) => {
  try {
    const rooms = await DormRoom.find({ floor: req.params.floorId }).lean();
    
    // For each room, fetch its beds and populated students
    const roomsWithBeds = await Promise.all(rooms.map(async (room) => {
      const beds = await DormBed.find({ room: room._id })
        .populate({
          path: 'student',
          select: 'studentId user',
          populate: { path: 'user', select: 'name' }
        });
      return { ...room, beds };
    }));

    res.json(roomsWithBeds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get beds by room
// @route   GET /api/housing/beds/:roomId
const getBeds = async (req, res) => {
  try {
    const beds = await DormBed.find({ room: req.params.roomId })
      .populate({
        path: 'student',
        select: 'studentId user',
        populate: { path: 'user', select: 'name' }
      });

    res.json(beds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign a student to a bed manually
// @route   POST /api/housing/assign-bed
const assignBed = async (req, res) => {
  try {
    const { bedId, studentUserId } = req.body;

    const bed = await DormBed.findById(bedId);
    if (!bed) return res.status(404).json({ message: 'Bed not found' });
    if (bed.isOccupied) return res.status(400).json({ message: 'Bed is already occupied' });

    const student = await Student.findOne({ user: studentUserId });
    if (!student) return res.status(404).json({ message: 'Student profile not found for this user' });
    bed.student = student._id;
    bed.isOccupied = true;
    await bed.save();

    // Update room status if full
    const roomBeds = await DormBed.find({ room: bed.room });
    if (roomBeds.every(b => b.isOccupied)) {
      await DormRoom.findByIdAndUpdate(bed.room, { status: 'OCCUPIED' });
    }

    // Update DormRequest
    await DormRequest.findOneAndUpdate(
      { student: studentUserId, requestType: 'CHECKIN', status: 'APPROVED' },
      { status: 'COMPLETED', responseNotes: `Manually assigned to bed ${bed.bedNumber}` }
    );

    res.json({ message: 'Bed assigned successfully', bed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get students without dormitory assignment
// @route   GET /api/housing/unassigned-students/:campusId
// @access  Private (Dormitory Admin)
const getUnassignedStudents = async (req, res) => {
  try {
    // DormBed.student stores Student._id (not User._id)
    const assignedStudentIds = await DormBed.find({ student: { $ne: null } }).distinct('student');
    
    const unassignedStudents = await require('../models/Student').find({
      campus: req.params.campusId,
      _id: { $nin: assignedStudentIds }  // filter by Student._id
    }).populate('user', 'name email');

    res.json(unassignedStudents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk assign students to beds
// @route   POST /api/housing/bulk-assign
// @access  Private (Dormitory Admin)
const bulkAssignBeds = async (req, res) => {
  try {
    const { assignments } = req.body; // Array of { studentUserId, bedId }
    if (!Array.isArray(assignments)) return res.status(400).json({ message: 'Assignments must be an array' });

    const results = { successful: 0, failed: 0, errors: [] };

    for (const assignment of assignments) {
      try {
        const { studentUserId, bedId } = assignment;
        const bed = await DormBed.findById(bedId);
        
        if (!bed) throw new Error('Bed not found');
        if (bed.isOccupied) throw new Error('Bed already occupied');

        const studentProfile = await Student.findOne({ user: studentUserId });
        if (!studentProfile) throw new Error(`Student profile not found for user ${studentUserId}`);

        bed.student = studentProfile._id;
        bed.isOccupied = true;
        await bed.save();

        // Update room status
        const roomBeds = await DormBed.find({ room: bed.room });
        if (roomBeds.every(b => b.isOccupied)) {
          await DormRoom.findByIdAndUpdate(bed.room, { status: 'OCCUPIED' });
        }

        results.successful++;
      } catch (err) {
        results.failed++;
        results.errors.push({ assignment, error: err.message });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Transfer a student to a new bed
// @route   POST /api/housing/transfer
const transferStudent = async (req, res) => {
  try {
    const { studentUserId, newBedId } = req.body;

    // 1. Find the new bed
    const newBed = await DormBed.findById(newBedId);
    if (!newBed) return res.status(404).json({ message: 'New bed not found' });
    if (newBed.isOccupied) return res.status(400).json({ message: 'New bed is already occupied' });

    // 2. Find and free the old bed
    const studentProfile = await Student.findOne({ user: studentUserId });
    if (!studentProfile) return res.status(404).json({ message: 'Student profile not found' });

    // 2. Find and free the old bed
    const oldBed = await DormBed.findOne({ student: studentProfile._id });
    if (oldBed) {
      oldBed.student = null;
      oldBed.isOccupied = false;
      await oldBed.save();

      // Update old room status (it might be available now)
      await DormRoom.findByIdAndUpdate(oldBed.room, { status: 'AVAILABLE' });
    }

    // 3. Occupy the new bed
    newBed.student = studentProfile._id;
    newBed.isOccupied = true;
    await newBed.save();

    // Update new room status if full
    const roomBeds = await DormBed.find({ room: newBed.room });
    if (roomBeds.every(b => b.isOccupied)) {
      await DormRoom.findByIdAndUpdate(newBed.room, { status: 'OCCUPIED' });
    }

    // 4. Update DormRequest if any
    await DormRequest.findOneAndUpdate(
      { student: studentUserId, requestType: 'ROOM_CHANGE', status: 'APPROVED' },
      { status: 'COMPLETED', responseNotes: `Transferred to bed ${newBed.bedNumber}` }
    );

    res.json({ message: 'Student transferred successfully', newBed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current student's bed assignment
// @route   GET /api/housing/my-bed
const getMyBed = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.json(null);
    }

    const bed = await DormBed.findOne({ student: student._id })
      .populate({
        path: 'room',
        populate: {
          path: 'floor',
          populate: {
            path: 'block',
            populate: {
              path: 'building'
            }
          }
        }
      });

    if (!bed) {
      return res.json(null);
    }

    res.json(bed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get dormitory statistics for admin
// @route   GET /api/housing/stats/:campusId
// @access  Private (Dormitory Admin)
const getDormStats = async (req, res) => {
  try {
    const campusId = req.params.campusId;
    
    const buildings = await DormBuilding.find({ campus: campusId });
    const buildingIds = buildings.map(b => b._id);
    
    const blocks = await DormBlock.find({ building: { $in: buildingIds } });
    const blockIds = blocks.map(b => b._id);
    
    const floors = await DormFloor.find({ block: { $in: blockIds } });
    const floorIds = floors.map(f => f._id);
    
    const rooms = await DormRoom.find({ floor: { $in: floorIds } });
    const roomIds = rooms.map(r => r._id);
    
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;
    
    const totalBeds = await DormBed.countDocuments({ room: { $in: roomIds } });
    const occupiedBeds = await DormBed.countDocuments({ room: { $in: roomIds }, isOccupied: true });
    
    const pendingRequests = await DormRequest.countDocuments({ status: 'PENDING' });
    
    // DormBed.student stores Student._id (not User._id)
    const assignedStudentIds = await DormBed.find(
      { room: { $in: roomIds }, student: { $ne: null } }
    ).distinct('student');
    const unassignedCount = await require('../models/Student').countDocuments({
      campus: campusId,
      _id: { $nin: assignedStudentIds }  // filter by Student._id
    });

    res.json({
      totalRooms,
      occupiedRooms,
      totalBeds,
      occupiedBeds,
      pendingRequests,
      unassignedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a proctor and assign a building
// @route   POST /api/housing/proctors
const createProctor = async (req, res) => {
  try {
    const { name, email, password, buildingId, campusId } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const proctor = await User.create({
      name,
      email,
      password,
      role: 'PROCTOR',
      campus: campusId,
      assignedBuilding: buildingId,
    });

    res.status(201).json(proctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get proctors for a campus
// @route   GET /api/housing/proctors/:campusId
const getProctors = async (req, res) => {
  try {
    const proctors = await User.find({ campus: req.params.campusId, role: 'PROCTOR' })
      .populate('assignedBuilding', 'name');
    res.json(proctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get detailed occupancy for a building (for proctors)
// @route   GET /api/housing/building-occupancy/:buildingId
const getBuildingOccupancy = async (req, res) => {
  try {
    const blocks = await DormBlock.find({ building: req.params.buildingId });
    const buildingData = [];

    for (const block of blocks) {
      const floors = await DormFloor.find({ block: block._id }).sort({ floorNumber: 1 });
      const blockData = {
        _id: block._id,
        name: block.name,
        floors: []
      };

      for (const floor of floors) {
        const rooms = await DormRoom.find({ floor: floor._id }).sort({ roomNumber: 1 });
        const floorRooms = [];

        for (const room of rooms) {
          const beds = await DormBed.find({ room: room._id })
            .populate({
              path: 'student',
              select: 'studentId user',
              populate: { path: 'user', select: 'name' }
            });
          floorRooms.push({
            ...room._doc,
            beds
          });
        }

        blockData.floors.push({
          ...floor._doc,
          rooms: floorRooms
        });
      }
      buildingData.push(blockData);
    }

    res.json(buildingData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    AI-Driven Roommate Matching
// @route   GET /api/housing/roommate-recommendations
// @access  Private (Student)
const getRecommendedRoommates = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).populate('department');
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const { dormitoryProfile } = student;
    if (!dormitoryProfile) {
      return res.json([]);
    }
    
    // 1. Find other students looking for roommates
    // We filter by gender and if they have a dormitoryProfile
    const potentialMatches = await Student.find({
      user: { $ne: req.user._id },
      gender: student.gender,
      dormitoryProfile: { $exists: true }
    }).populate('user', 'name email').populate('department');

    if (!potentialMatches) {
      return res.json([]);
    }

    // 2. Score matches based on habits and department
    const myProfile = dormitoryProfile || {};
    const scoredMatches = potentialMatches.map(other => {
      let score = 0;
      const otherProfile = other.dormitoryProfile || {};

      // Same department? +2 points
      if (other.department && student.department && other.department._id.toString() === student.department._id.toString()) {
        score += 2;
      }

      // Habits match?
      if (otherProfile.sleepHabit === myProfile.sleepHabit) score += 1;
      if (otherProfile.studyHabit === myProfile.studyHabit) score += 1;
      if (otherProfile.isSmoker === myProfile.isSmoker) score += 2; // Critical match

      // Common interests?
      const myInterests = (myProfile.interests || []);
      const otherInterests = (otherProfile.interests || []);
      const commonInterests = otherInterests.filter(i => myInterests.includes(i));
      score += commonInterests.length * 0.5;

      return {
        student: other,
        matchScore: score,
        commonInterests
      };
    });

    // 3. Sort by score and return top matches
    scoredMatches.sort((a, b) => b.matchScore - a.matchScore);

    res.json(scoredMatches.slice(0, 10));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a building
// @route   PUT /api/housing/buildings/:id
const updateBuilding = async (req, res) => {
  try {
    const building = await DormBuilding.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!building) return res.status(404).json({ message: 'Building not found' });
    res.json(building);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a building recursively
// @route   DELETE /api/housing/buildings/:id
const deleteBuilding = async (req, res) => {
  try {
    const buildingId = req.params.id;
    const blocks = await DormBlock.find({ building: buildingId });
    const blockIds = blocks.map(b => b._id);
    
    const floors = await DormFloor.find({ block: { $in: blockIds } });
    const floorIds = floors.map(f => f._id);
    
    const rooms = await DormRoom.find({ floor: { $in: floorIds } });
    const roomIds = rooms.map(r => r._id);
    
    await DormBed.deleteMany({ room: { $in: roomIds } });
    await DormRoom.deleteMany({ _id: { $in: roomIds } });
    await DormFloor.deleteMany({ _id: { $in: floorIds } });
    await DormBlock.deleteMany({ _id: { $in: blockIds } });
    await DormBuilding.findByIdAndDelete(buildingId);
    
    res.json({ message: 'Building and all associated data deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a floor
// @route   PUT /api/housing/floors/:id
const updateFloor = async (req, res) => {
  try {
    const floor = await DormFloor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!floor) return res.status(404).json({ message: 'Floor not found' });
    res.json(floor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a floor recursively
// @route   DELETE /api/housing/floors/:id
const deleteFloor = async (req, res) => {
  try {
    const floorId = req.params.id;
    const rooms = await DormRoom.find({ floor: floorId });
    const roomIds = rooms.map(r => r._id);
    
    await DormBed.deleteMany({ room: { $in: roomIds } });
    await DormRoom.deleteMany({ _id: { $in: roomIds } });
    await DormFloor.findByIdAndDelete(floorId);
    
    res.json({ message: 'Floor and all associated rooms/beds deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a room
// @route   PUT /api/housing/rooms/:id
const updateRoom = async (req, res) => {
  try {
    const room = await DormRoom.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a room recursively
// @route   DELETE /api/housing/rooms/:id
const deleteRoom = async (req, res) => {
  try {
    const roomId = req.params.id;
    await DormBed.deleteMany({ room: roomId });
    await DormRoom.findByIdAndDelete(roomId);
    
    res.json({ message: 'Room and its beds deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a proctor
// @route   PUT /api/housing/proctors/:id
const updateProctor = async (req, res) => {
  try {
    const { name, email, password, buildingId } = req.body;
    const user = await User.findById(req.params.id);

    if (!user || user.role !== 'PROCTOR') {
      return res.status(404).json({ message: 'Proctor not found' });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.assignedBuilding = buildingId || user.assignedBuilding;
    
    if (password) {
      user.password = password;
    }

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a proctor
// @route   DELETE /api/housing/proctors/:id
const deleteProctor = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role !== 'PROCTOR') {
      return res.status(404).json({ message: 'Proctor not found' });
    }

    await user.deleteOne();
    res.json({ message: 'Proctor removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
};
