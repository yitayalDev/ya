const DormRequest = require('../models/DormRequest');
const Dormitory = require('../models/Dormitory');
const DormBed = require('../models/DormBed');
const DormBlock = require('../models/DormBlock');

// @desc    Get requests for a dormitory
// @route   GET /api/dorm-requests
// @access  Private/Dormitory Admin
const getDormRequests = async (req, res) => {
  try {
    console.log('getDormRequests called by user:', req.user.id);
    
    const dormitory = await Dormitory.findOne({ dormitoryAdmin: req.user.id });
    if (!dormitory) {
      console.log('No dormitory found for admin:', req.user.id);
      return res.status(404).json({ message: 'Dormitory not found for this admin' });
    }

    console.log('Found dormitory:', dormitory._id);

    const { status, requestType } = req.query;
    const filter = { 
      dormitory: dormitory._id
    };
    if (status) filter.status = status;
    if (requestType) filter.requestType = requestType;

    console.log('Query filter:', filter);

    const requests = await DormRequest.find(filter)
      .populate('student', 'name email studentId')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    console.log('Found', requests.length, 'requests');

    if (!requests || requests.length === 0) {
      return res.json([]);
    }

    // Enrich with current bed/room info for each student
    const enrichedRequests = await Promise.all(requests.map(async (reqItem) => {
      try {
        if (!reqItem.student || !reqItem.student._id) {
          return reqItem.toObject();
        }

        // Find student profile for this user
        const Student = require('../models/Student');
        const studentProfile = await Student.findOne({ user: reqItem.student._id });
        if (!studentProfile) return reqItem.toObject();

        const bed = await DormBed.findOne({ student: studentProfile._id })
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

        const reqObj = reqItem.toObject();
        if (bed && bed.room) {
          reqObj.bed = {
            bedNumber: bed.bedNumber,
            room: {
              roomNumber: bed.room.roomNumber,
              floor: {
                floorNumber: bed.room.floor?.floorNumber || 0,
                block: {
                  name: bed.room.floor?.block?.name || 'Unknown',
                  building: {
                    name: bed.room.floor?.block?.building?.name || 'Unknown'
                  }
                }
              }
            }
          };
        } else {
          reqObj.bed = null;
        }

        return reqObj;
      } catch (err) {
        console.error('Error enriching request for student', reqItem.student?._id, err.message);
        return reqItem.toObject();
      }
    }));

    res.json(enrichedRequests);
  } catch (error) {
    console.error('getDormRequests error:', error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
};

// @desc    Create request (for students - via student dashboard)
// @route   POST /api/dorm-requests
// @access  Private/Student
const createDormRequest = async (req, res) => {
  try {
    const { requestType, description, priority } = req.body;

    const dormitory = await Dormitory.findById(req.body.dormitoryId);
    if (!dormitory) {
      return res.status(404).json({ message: 'Dormitory not found' });
    }

    // AI-Driven Priority Detection
    let aiPriority = priority || 'MEDIUM';
    const lowDesc = description.toLowerCase();
    
    const urgentKeywords = ['leak', 'fire', 'hazard', 'smoke', 'electricity', 'broken lock', 'security', 'flood'];
    const highKeywords = ['no water', 'no light', 'internet down', 'broken bed', 'pest'];
    
    if (urgentKeywords.some(kw => lowDesc.includes(kw))) {
      aiPriority = 'URGENT';
    } else if (highKeywords.some(kw => lowDesc.includes(kw))) {
      aiPriority = 'HIGH';
    }

    const request = await DormRequest.create({
      student: req.user.id,
      dormitory: dormitory._id,
      requestType,
      description,
      priority: aiPriority,
      needsAdminReview: aiPriority === 'URGENT',
    });

    const populatedRequest = await DormRequest.findById(request._id)
      .populate('student', 'name email studentId')
      .populate('dormitory', 'name');

    res.status(201).json(populatedRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update request status
// @route   PUT /api/dorm-requests/:id
// @access  Private/Dormitory Admin
const updateDormRequest = async (req, res) => {
  try {
    const { status, responseNotes, assignedTo, scheduledDate, priority, needsAdminReview } = req.body;

    const request = await DormRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (status) {
      request.status = status;
      if (status === 'COMPLETED') {
        request.completedDate = new Date();
      }
    }
    if (priority) request.priority = priority;
    if (needsAdminReview !== undefined) request.needsAdminReview = needsAdminReview;
    if (responseNotes) {
      request.responseNotes = responseNotes;
      request.responseDate = new Date();
    }
    if (assignedTo) request.assignedTo = assignedTo;
    if (scheduledDate) request.scheduledDate = scheduledDate;

    await request.save();

    // Trigger Notification
    const { createNotification } = require('./notificationController');
    await createNotification({
      recipient: request.student,
      title: 'Dorm Request Update',
      message: `Your ${request.requestType} request status has been updated to ${status}. ${responseNotes ? 'Note: ' + responseNotes : ''}`,
      type: 'DORM',
      priority: status === 'REJECTED' || status === 'COMPLETED' ? 'NORMAL' : 'HIGH',
      relatedId: request._id
    });

    const updatedRequest = await DormRequest.findById(request._id)
      .populate('student', 'name email studentId')
      .populate('assignedTo', 'name');

    res.json(updatedRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single request
// @route   GET /api/dorm-requests/:id
// @access  Private/Dormitory Admin
const getDormRequest = async (req, res) => {
  try {
    const request = await DormRequest.findById(req.params.id)
      .populate('student', 'name email studentId')
      .populate('dormitory', 'name')
      .populate('assignedTo', 'name');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get requests for a proctor's block
// @route   GET /api/dorm-requests/proctor
// @access  Private/Proctor
const getProctorRequests = async (req, res) => {
  try {
    console.log('getProctorRequests called by user:', req.user.id, 'role:', req.user.role);
    
    if (req.user.role !== 'PROCTOR' || !req.user.assignedBuilding) {
      console.log('Unauthorized or no building assigned');
      return res.status(403).json({ message: 'Not authorized or no building assigned' });
    }

    console.log('Proctor assigned building:', req.user.assignedBuilding);

    // 1. Find all blocks in the proctor's assigned building
    const blocks = await DormBlock.find({ building: req.user.assignedBuilding });
    const blockIds = blocks.map(b => b._id);

    // 2. Find all students in these blocks and get their User IDs
    const beds = await DormBed.find({ isOccupied: true }).populate({
      path: 'room',
      populate: { path: 'floor', populate: { path: 'block' } }
    }).populate('student');

    const studentUserIdsInBuilding = beds
      .filter(b => {
        if (!b.room?.floor?.block?._id || !b.student) return false;
        return blockIds.map(id => id.toString()).includes(b.room.floor.block._id.toString());
      })
      .map(b => b.student.user?.toString() || b.student.user)
      .filter(id => id != null);

    console.log('Found', studentUserIdsInBuilding.length, 'students in building');

    if (studentUserIdsInBuilding.length === 0) {
      return res.json([]);
    }

    // 3. Fetch requests for these students (DormRequest stores User ID in 'student' field)
    const requests = await DormRequest.find({ 
      student: { $in: studentUserIdsInBuilding }
    })
    .populate({
      path: 'student',
      select: 'name email studentId'
    })
    .sort({ createdAt: -1 });

    console.log('Found', requests.length, 'requests');

    if (!requests || requests.length === 0) {
      return res.json([]);
    }

    // Enrich with bed/room info (DormBed stores Student ID in 'student' field)
    const Student = require('../models/Student');
    const enrichedRequests = await Promise.all(requests.map(async (reqItem) => {
      try {
        if (!reqItem.student || !reqItem.student._id) {
          return reqItem.toObject();
        }

        // Find student profile for this user
        const studentProfile = await Student.findOne({ user: reqItem.student._id });
        if (!studentProfile) return reqItem.toObject();

        const bed = await DormBed.findOne({ student: studentProfile._id })
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

        const reqObj = reqItem.toObject();
        if (bed && bed.room) {
          reqObj.bed = {
            bedNumber: bed.bedNumber,
            room: {
              roomNumber: bed.room.roomNumber,
              floor: {
                floorNumber: bed.room.floor?.floorNumber || 0,
                block: {
                  name: bed.room.floor?.block?.name || 'Unknown',
                  building: {
                    name: bed.room.floor?.block?.building?.name || 'Unknown'
                  }
                }
              }
            }
          };
        } else {
          reqObj.bed = null;
        }

        return reqObj;
      } catch (err) {
        console.error('Error enriching proctor request', err);
        return reqItem.toObject();
      }
    }));

    res.json(enrichedRequests);
  } catch (error) {
    console.error('getProctorRequests error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current student's requests
// @route   GET /api/dorm-requests/my-requests
// @access  Private/Student
const getMyRequests = async (req, res) => {
  try {
    const requests = await DormRequest.find({ student: req.user.id })
      .populate('dormitory', 'name')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDormRequests,
  getDormRequest,
  createDormRequest,
  updateDormRequest,
  getProctorRequests,
  getMyRequests,
};