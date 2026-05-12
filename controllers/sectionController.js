const Section = require('../models/Section');
const User = require('../models/User');

// Helper to check for time overlaps
const isOverlapping = (s1Start, s1End, s2Start, s2End) => {
  return s1Start < s2End && s2Start < s1End;
};

// @desc    Get all sections for a department
// @route   GET /api/sections
// @access  Private
const getSections = async (req, res) => {
  try {
    let query = {};
    
    // Role-based filtering
    if (req.user.role === 'DEPARTMENT_ADMIN') {
      if (!req.user.department) {
        return res.json([]); // Return empty array if admin is not assigned to a department
      }
      query.department = req.user.department;
    } else if (req.user.role === 'COLLEGE_ADMIN') {
      query.college = req.user.college;
    }

    // Query parameter filtering
    if (req.query.course) {
      query.course = req.query.course;
    }
    if (req.query.semester) {
      query.semester = req.query.semester;
    }
    if (req.query.department && req.user.role !== 'DEPARTMENT_ADMIN') {
      query.department = req.query.department;
    }

    const sections = await Section.find(query)
      .populate('course', 'title code')
      .populate('instructor', 'name')
      .populate({
        path: 'semester',
        select: 'name academicYear',
        populate: { path: 'academicYear', select: 'name' }
      });
    
    res.json(sections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a section
// @route   POST /api/sections
// @access  Private (Dept Admin)
const createSection = async (req, res) => {
  const { 
    sectionName, 
    courseId, 
    instructorId, 
    semesterId, 
    academicCalendarId, // Fallback
    classroom, 
    capacity, 
    schedule 
  } = req.body;

  const actualSemesterId = semesterId || academicCalendarId;

  try {
    // 1. Instructor must belong to the same department
    const instructor = await User.findById(instructorId);
    
    if (!instructor) {
      return res.status(400).json({ message: 'Instructor not found' });
    }

    if (!instructor.department) {
      console.log('DEBUG: Instructor has no department. Automatically assigning to:', req.user.department);
      instructor.department = req.user.department;
      await instructor.save();
    }

    if (!req.user.department) {
      return res.status(400).json({ message: 'Admin department assignment is missing' });
    }

    if (instructor.department.toString() !== req.user.department.toString()) {
      return res.status(400).json({ message: 'Instructor must belong to your department' });
    }

    // 2. Check for Schedule Conflicts (Instructor & Classroom)
    const existingSections = await Section.find({ semester: actualSemesterId });

    for (const newSched of schedule) {
      for (const oldSec of existingSections) {
        for (const oldSched of oldSec.schedule) {
          if (newSched.day === oldSched.day) {
            const overlap = isOverlapping(newSched.startTime, newSched.endTime, oldSched.startTime, oldSched.endTime);
            
            if (overlap) {
              // Instructor conflict
              if (oldSec.instructor.toString() === instructorId) {
                return res.status(400).json({ 
                  message: `Instructor conflict on ${newSched.day} at ${newSched.startTime}` 
                });
              }
              // Classroom conflict
              if (oldSec.classroom === classroom) {
                return res.status(400).json({ 
                  message: `Classroom ${classroom} is double-booked on ${newSched.day}` 
                });
              }
            }
          }
        }
      }
    }

    const section = await Section.create({
      sectionName,
      course: courseId,
      instructor: instructorId,
      semester: actualSemesterId,
      classroom,
      capacity,
      schedule,
      department: req.user.department,
    });

    // Populate the newly created section
    const populatedSection = await Section.findById(section._id)
      .populate('course', 'title code')
      .populate('instructor', 'name')
      .populate({
        path: 'semester',
        select: 'name academicYear',
        populate: { path: 'academicYear', select: 'name' }
      });

    res.status(201).json(populatedSection);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Section name already exists for this course' });
    }
    res.status(400).json({ message: error.message });
  }
};

// @desc    Create multiple sections in bulk
// @route   POST /api/sections/bulk
// @access  Private (Dept Admin)
const createBulkSections = async (req, res) => {
  const { 
    sectionName, 
    courseIds, 
    instructorId, 
    courseInstructorMap, 
    semesterId, 
    academicCalendarId, // Fallback
    classroom, 
    capacity, 
    schedule 
  } = req.body;

  const actualSemesterId = semesterId || academicCalendarId;

  try {
    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of course IDs' });
    }

    if (!req.user.department) {
      return res.status(400).json({ message: 'Admin department assignment is missing' });
    }

    const existingSections = await Section.find({ semester: actualSemesterId });
    const results = [];
    const errors = [];

    for (const courseId of courseIds) {
      try {
        // Determine instructor for this specific course
        const targetInstructorId = (courseInstructorMap && courseInstructorMap[courseId]) || instructorId;
        
        if (!targetInstructorId) {
          throw new Error(`No instructor assigned for course ${courseId}`);
        }

        // Check for Schedule Conflicts (Instructor & Classroom)
        for (const newSched of schedule) {
          for (const oldSec of existingSections) {
            for (const oldSched of oldSec.schedule) {
              if (newSched.day === oldSched.day) {
                const overlap = isOverlapping(newSched.startTime, newSched.endTime, oldSched.startTime, oldSched.endTime);
                
                if (overlap) {
                  if (oldSec.instructor.toString() === targetInstructorId) {
                    throw new Error(`Instructor conflict for course ${courseId} on ${newSched.day} at ${newSched.startTime}`);
                  }
                  if (oldSec.classroom === classroom) {
                    throw new Error(`Classroom conflict for course ${courseId} on ${newSched.day}`);
                  }
                }
              }
            }
          }
        }

        const section = await Section.create({
          sectionName,
          course: courseId,
          instructor: targetInstructorId,
          semester: actualSemesterId,
          classroom,
          capacity,
          schedule,
          department: req.user.department,
        });
        
        results.push(section._id);
      } catch (err) {
        console.error(`Bulk section error for course ${courseId}:`, err);
        errors.push(err.message || 'Unknown error');
      }
    }

    const message = errors.length > 0 
      ? `Processed ${courseIds.length} sections. Success: ${results.length}, Failed: ${errors.length}. Error: ${errors[0]}`
      : `Successfully created ${results.length} sections.`;

    res.status(201).json({
      message,
      successfulIds: results,
      errors: errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a section
// @route   PUT /api/sections/:id
// @access  Private (Dept Admin)
const updateSection = async (req, res) => {
  try {
    let section = await Section.findById(req.params.id);

    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Authorization
    if (req.user.role === 'DEPARTMENT_ADMIN' && section.department.toString() !== req.user.department.toString()) {
      return res.status(401).json({ message: 'Not authorized to update this section' });
    }

    section = await Section.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    .populate('course', 'title code')
    .populate('instructor', 'name')
    .populate({
      path: 'semester',
      select: 'name academicYear',
      populate: { path: 'academicYear', select: 'name' }
    });

    res.json(section);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a section
// @route   DELETE /api/sections/:id
// @access  Private (Dept Admin)
const deleteSection = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);

    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Authorization
    if (req.user.role === 'DEPARTMENT_ADMIN' && section.department.toString() !== req.user.department.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this section' });
    }

    await section.deleteOne();

    res.json({ message: 'Section removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  getSections, 
  createSection, 
  createBulkSections,
  updateSection,
  deleteSection
};
