const Student = require('../models/Student');
const DormBed = require('../models/DormBed');
const DormRoom = require('../models/DormRoom');
const DormFloor = require('../models/DormFloor');
const DormBlock = require('../models/DormBlock');
const DormBuilding = require('../models/DormBuilding');
const DormRequest = require('../models/DormRequest');

// @desc    Get allocation preview
// @route   POST /api/housing/allocation-preview
const getAllocationPreview = async (req, res) => {
  try {
    let { campusId, criteria = [] } = req.body;

    if (!campusId) {
      return res.status(400).json({ message: 'campusId is required' });
    }

    // Ensure criteria is an array
    if (!Array.isArray(criteria)) {
      return res.status(400).json({ message: 'criteria must be an array' });
    }

    // Use default if empty
    if (criteria.length === 0) {
      criteria = ['DEPARTMENT'];
    }

    const validCriteria = ['SEX', 'DEPARTMENT', 'YEAR', 'ALPHABET'];
    const filteredCriteria = criteria.filter(c => validCriteria.includes(c));
    const occupiedBeds = await DormBed.find({ isOccupied: true }).lean().select('student');
    const occupiedStudentIds = occupiedBeds.map(b => b.student?.toString()).filter(id => id);

    // Find Student profiles for these users in the specified campus
    let students = await Student.find({ campus: campusId, user: { $nin: occupiedStudentIds } })
      .populate('user', 'name email')
      .populate('department', 'name')
      .populate('college', 'name');

    // Filter out any students where user population failed
    students = students.filter(s => s.user);

    if (students.length === 0) {
      console.log('Auto-allocate: No unassigned students found for campus', campusId);
      return res.status(400).json({ message: 'No unassigned students found for this campus' });
    }

    // Group students based on validated criteria
    const groupings = groupStudents(students, filteredCriteria);

    res.json({
      totalStudents: students.length,
      groupings,
    });
  } catch (error) {
    console.error('getAllocationPreview error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Run auto allocation
// @route   POST /api/housing/auto-allocate
const autoAllocate = async (req, res) => {
  try {
    let { campusId, criteria = [] } = req.body;

    if (!campusId) {
      return res.status(400).json({ message: 'campusId is required' });
    }

    // Ensure criteria is an array
    if (!Array.isArray(criteria)) {
      return res.status(400).json({ message: 'criteria must be an array' });
    }

    // Use default if empty
    if (criteria.length === 0) {
      criteria = ['DEPARTMENT'];
    }

    // Validate criteria values
    const validCriteria = ['SEX', 'DEPARTMENT', 'YEAR', 'ALPHABET'];
    const filteredCriteria = criteria.filter(c => validCriteria.includes(c));
    if (filteredCriteria.length === 0) {
      return res.status(400).json({ message: 'At least one valid criteria is required (SEX, DEPARTMENT, YEAR, ALPHABET)' });
    }

    // 1. Fetch all unassigned students in the campus
    const occupiedBeds = await DormBed.find({ isOccupied: true }).lean().select('student');
    const occupiedStudentIds = occupiedBeds.map(b => b.student?.toString()).filter(id => id);

    let students = await Student.find({ campus: campusId, user: { $nin: occupiedStudentIds } })
      .populate('user', 'name email')
      .populate('department', 'name');

    // Filter out any students where user population failed
    students = students.filter(s => s.user);

    if (students.length === 0) {
      console.log('Auto-allocate: No unassigned students found for campus', campusId);
      return res.status(400).json({ message: 'No unassigned students found for this campus' });
    }

    // 2. Fetch available beds for the campus, populated with room data
    console.log('Fetching available beds for campus:', campusId);

    const buildings = await DormBuilding.find({ campus: campusId }).sort({ name: 1 });
    const buildingIds = buildings.map(b => b._id);

    const blocks = await DormBlock.find({ building: { $in: buildingIds } }).sort({ name: 1 });
    const blockIds = blocks.map(b => b._id);

    const floors = await DormFloor.find({ block: { $in: blockIds } }).sort({ floorNumber: 1 });
    const floorIds = floors.map(f => f._id);

    const rooms = await DormRoom.find({ floor: { $in: floorIds }, status: 'AVAILABLE' });
    const roomIds = rooms.map(r => r._id);

    // Get all available beds in these rooms, populated to access room details (genderType)
    let availableBeds = await DormBed.find({ room: { $in: roomIds }, isOccupied: false })
      .populate('room');

    console.log(`Auto-allocate: Found ${availableBeds.length} available beds across ${rooms.length} rooms`);

    if (availableBeds.length === 0) {
      console.log('Auto-allocate: No available beds for campus', campusId);
      return res.status(400).json({ message: 'No available beds found in this campus. Please add rooms and beds first.' });
    }

    // Build hierarchy map for sorting beds strictly (Building -> Block -> Floor -> Room)
    const roomHierarchy = {};
    for (const room of rooms) {
      const floor = floors.find(f => f._id.equals(room.floor));
      const block = blocks.find(b => b._id.equals(floor?.block));
      const building = buildings.find(b => b._id.equals(block?.building));
      roomHierarchy[room._id.toString()] = {
        buildingName: building?.name || '',
        blockName: block?.name || '',
        floorNumber: floor?.floorNumber || 0,
        roomNumber: room.roomNumber || '',
      };
    }

    // Ensure cascade allocation: Building -> Block -> Floor -> Room -> Bed
    availableBeds.sort((a, b) => {
      const ra = roomHierarchy[a.room._id.toString()] || {};
      const rb = roomHierarchy[b.room._id.toString()] || {};
      
      let cmp = (ra.buildingName || '').localeCompare(rb.buildingName || '');
      if (cmp !== 0) return cmp;
      
      cmp = (ra.blockName || '').localeCompare(rb.blockName || '');
      if (cmp !== 0) return cmp;
      
      cmp = (ra.floorNumber || 0) - (rb.floorNumber || 0);
      if (cmp !== 0) return cmp;
      
      cmp = (ra.roomNumber || '').localeCompare(rb.roomNumber || '');
      if (cmp !== 0) return cmp;
      
      return (a.bedNumber || '').localeCompare(b.bedNumber || '');
    });

    // 3. Sort students based on validated criteria
    const sortedStudents = sortStudents(students, filteredCriteria);

    // 4. Allocation Process (Cascading + Gender Match)
    const results = { assigned: [], unassigned: [] };

    for (const student of sortedStudents) {
      // Find the first available bed that matches the student's gender constraints
      const bedIndex = availableBeds.findIndex(bed => {
        const roomGender = bed.room.genderType ? bed.room.genderType.toUpperCase() : 'MIXED';
        const studentGender = student.gender ? student.gender.toUpperCase() : 'UNKNOWN';
        return roomGender === 'MIXED' || roomGender === studentGender;
      });

      if (bedIndex !== -1) {
        const bed = availableBeds[bedIndex];

        // Remove the bed from the available list so it's not double-booked
        availableBeds.splice(bedIndex, 1);

        // Update bed occupancy
        bed.student = student._id;
        bed.isOccupied = true;
        await bed.save();

        // Check if room is now full and update status
        const roomBeds = await DormBed.find({ room: bed.room._id });
        const allOccupied = roomBeds.every(b => b.isOccupied);
        if (allOccupied) {
          await DormRoom.findByIdAndUpdate(bed.room._id, { status: 'OCCUPIED' });
        }

        // Update request status if any CHECKIN request exists
        await DormRequest.findOneAndUpdate(
          { student: student.user._id, requestType: 'CHECKIN', status: 'APPROVED' },
          { status: 'COMPLETED', responseNotes: `Auto-allocated to bed ${bed.bedNumber}` }
        );

        results.assigned.push({
          studentName: student.user.name,
          studentId: student.studentId,
          bedNumber: bed.bedNumber,
        });
      } else {
        // No matching bed available for this student (could be full, or no beds matching gender)
        results.unassigned.push({
          studentName: student.user?.name || 'Unknown',
          studentId: student.studentId || 'Unknown',
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('autoAllocate error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Helper function to group students for preview
const groupStudents = (students, criteria) => {
  const groups = {};

  students.forEach(student => {
    let key = '';
    if (criteria.includes('SEX')) key += `${student.gender || 'Unknown'}_`;
    if (criteria.includes('DEPARTMENT')) key += `${student.department?.name || 'NoDept'}_`;
    if (criteria.includes('YEAR')) key += `${student.academicYear || 'NoYear'}_`;

    if (key === '') key = 'ALL';
    else key = key.slice(0, -1);

    if (!groups[key]) groups[key] = [];
    groups[key].push(student.user.name);
  });

  return groups;
};

// Helper function to sort students based on criteria
const sortStudents = (students, criteria) => {
  return [...students].sort((a, b) => {
    if (criteria.includes('SEX')) {
      const genderOrder = (a.gender || '').localeCompare(b.gender || '');
      if (genderOrder !== 0) return genderOrder;
    }

    if (criteria.includes('DEPARTMENT')) {
      const deptOrder = (a.department?.name || '').localeCompare(b.department?.name || '');
      if (deptOrder !== 0) return deptOrder;
    }

    if (criteria.includes('YEAR')) {
      const yearOrder = (a.academicYear || '').localeCompare(b.academicYear || '');
      if (yearOrder !== 0) return yearOrder;
    }

    if (criteria.includes('ALPHABET')) {
      return (a.user.name || '').localeCompare(b.user.name || '');
    }

    return 0;
  });
};

module.exports = {
  getAllocationPreview,
  autoAllocate,
};
