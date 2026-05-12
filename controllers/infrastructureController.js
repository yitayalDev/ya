const AcademicBuilding = require('../models/AcademicBuilding');
const AcademicRoom = require('../models/AcademicRoom');

// @desc    Get all buildings
// @route   GET /api/infrastructure/buildings
// @access  Private (Super Admin)
const getBuildings = async (req, res) => {
    try {
        const buildings = await AcademicBuilding.find({}).populate('campus', 'name');
        res.json(buildings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a building
// @route   POST /api/infrastructure/buildings
// @access  Private (Super Admin)
const createBuilding = async (req, res) => {
    try {
        const building = await AcademicBuilding.create(req.body);
        res.status(201).json(building);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get rooms by building
// @route   GET /api/infrastructure/rooms/:buildingId
// @access  Private
const getRoomsByBuilding = async (req, res) => {
    try {
        const rooms = await AcademicRoom.find({ building: req.params.buildingId });
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a room
// @route   POST /api/infrastructure/rooms
// @access  Private (Super Admin)
const createRoom = async (req, res) => {
    try {
        const room = await AcademicRoom.create(req.body);
        res.status(201).json(room);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getBuildings,
    createBuilding,
    getRoomsByBuilding,
    createRoom
};
