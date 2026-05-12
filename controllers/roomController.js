const Room = require('../models/Room');
const Dormitory = require('../models/Dormitory');
const User = require('../models/User');

// @desc    Get rooms for a dormitory
// @route   GET /api/rooms
// @access  Private/Dormitory Admin
const getRooms = async (req, res) => {
  try {
    const dormitory = await Dormitory.findOne({ dormitoryAdmin: req.user.id });
    if (!dormitory) {
      return res.status(404).json({ message: 'Dormitory not found' });
    }

    const rooms = await Room.find({ dormitory: dormitory._id })
      .populate('occupants.student', 'name email studentId');

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single room
// @route   GET /api/rooms/:id
// @access  Private/Dormitory Admin
const getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('occupants.student', 'name email studentId');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create room
// @route   POST /api/rooms
// @access  Private/Dormitory Admin
const createRoom = async (req, res) => {
  try {
    const dormitory = await Dormitory.findOne({ dormitoryAdmin: req.user.id });
    if (!dormitory) {
      return res.status(404).json({ message: 'Dormitory not found' });
    }

    const { roomNumber, floor, roomType, capacity, amenities, notes } = req.body;

    const existingRoom = await Room.findOne({
      dormitory: dormitory._id,
      roomNumber,
    });

    if (existingRoom) {
      return res.status(400).json({ message: 'Room number already exists in this dormitory' });
    }

    const room = await Room.create({
      dormitory: dormitory._id,
      roomNumber,
      floor,
      roomType,
      capacity,
      amenities,
      notes,
    });

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private/Dormitory Admin
const updateRoom = async (req, res) => {
  try {
    const { roomNumber, floor, roomType, capacity, amenities, status, notes } = req.body;

    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (roomNumber) room.roomNumber = roomNumber;
    if (floor) room.floor = floor;
    if (roomType) room.roomType = roomType;
    if (capacity) room.capacity = capacity;
    if (amenities) room.amenities = amenities;
    if (status) room.status = status;
    if (notes) room.notes = notes;

    await room.save();

    const updatedRoom = await Room.findById(room._id)
      .populate('occupants.student', 'name email studentId');

    res.json(updatedRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign student to room
// @route   POST /api/rooms/:id/assign
// @access  Private/Dormitory Admin
const assignStudent = async (req, res) => {
  try {
    const { studentId } = req.body;

    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.currentOccupancy >= room.capacity) {
      return res.status(400).json({ message: 'Room is at full capacity' });
    }

    const student = await User.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const alreadyAssigned = room.occupants.find(
      (o) => o.student.toString() === student._id.toString() && o.isActive
    );
    if (alreadyAssigned) {
      return res.status(400).json({ message: 'Student already assigned to this room' });
    }

    room.occupants.push({
      student: student._id,
      checkInDate: new Date(),
      isActive: true,
    });
    room.currentOccupancy += 1;
    room.status = room.currentOccupancy >= room.capacity ? 'OCCUPIED' : 'AVAILABLE';

    await room.save();

    const updatedRoom = await Room.findById(room._id)
      .populate('occupants.student', 'name email studentId');

    res.json(updatedRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove student from room
// @route   POST /api/rooms/:id/remove
// @access  Private/Dormitory Admin
const removeStudent = async (req, res) => {
  try {
    const { studentId } = req.body;

    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const occupantIndex = room.occupants.findIndex(
      (o) => o.student.toString() === studentId && o.isActive
    );
    if (occupantIndex === -1) {
      return res.status(404).json({ message: 'Student not found in this room' });
    }

    room.occupants[occupantIndex].isActive = false;
    room.occupants[occupantIndex].checkOutDate = new Date();
    room.currentOccupancy -= 1;
    room.status = room.currentOccupancy === 0 ? 'AVAILABLE' : 'OCCUPIED';

    await room.save();

    const updatedRoom = await Room.findById(room._id)
      .populate('occupants.student', 'name email studentId');

    res.json(updatedRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete room
// @route   DELETE /api/rooms/:id
// @access  Private/Dormitory Admin
const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.currentOccupancy > 0) {
      return res.status(400).json({ message: 'Cannot delete room with occupants' });
    }

    await room.deleteOne();

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  assignStudent,
  removeStudent,
  deleteRoom,
};