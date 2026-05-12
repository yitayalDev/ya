const Material = require('../models/Material');
const Section = require('../models/Section');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/materials');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'material-' + uniqueSuffix + extension);
  }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv'
  ];

  const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.avi', '.mov', '.wmv'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || (file.mimetype === 'application/octet-stream' && allowedExtensions.includes(ext))) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX, images, and videos are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

// @desc    Upload material
// @route   POST /api/instructor/materials/upload
// @access  Private (Instructor)
const uploadMaterial = async (req, res) => {
  try {
    const { title, description, materialType, sectionId } = req.body;

    // Validate required fields
    if (!title || !materialType || !sectionId) {
      return res.status(400).json({
        message: 'Title, material type, and section ID are required'
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }

    // Verify section exists and instructor is assigned to it
    const section = await Section.findById(sectionId)
      .populate('course')
      .populate('semester');

    if (!section) {
      // Clean up uploaded file if section not found
      if (req.file && req.file.path) {
        const fs = require('fs');
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: 'Section not found' });
    }

    // Check if the logged-in user is the instructor for this section
    if (!section.instructor || section.instructor.toString() !== req.user._id.toString()) {
      if (req.file && req.file.path) {
        const fs = require('fs');
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        message: 'Not authorized to upload materials for this section'
      });
    }

    // Safely extract course and semester IDs
    const courseId = section.course?._id || section.course;
    const semesterId = section.semester?._id || section.semester;

    if (!courseId) {
      return res.status(400).json({ message: 'Section has no associated course' });
    }

    const courseCode = section.course?.code || 'Unknown';
    const sectionName = section.sectionName || 'Unknown';

    // Create material record
    const material = await Material.create({
      title,
      description,
      materialType,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      course: courseId,
      section: sectionId,
      instructor: req.user._id,
      semester: semesterId,
    });

    // Populate the response
    await material.populate([
      { path: 'course', select: 'code title' },
      { path: 'section', select: 'sectionName' },
      { path: 'instructor', select: 'name' }
    ]);

    res.status(201).json({
      message: `${materialType} successfully uploaded for ${courseCode} - Section ${sectionName}`,
      material: {
        _id: material._id,
        title: material.title,
        description: material.description,
        materialType: material.materialType,
        fileName: material.fileName,
        fileSize: material.fileSize,
        mimeType: material.mimeType,
        uploadedAt: material.uploadedAt,
        course: material.course,
        section: material.section,
        instructor: material.instructor,
      }
    });
  } catch (error) {
    console.error('uploadMaterial error:', error.message);
    console.error(error.stack);
    // Return a descriptive error message
    res.status(500).json({ message: error.message || 'An error occurred while uploading the material' });
  }
};

// @desc    Get materials for instructor's sections
// @route   GET /api/instructor/materials
// @access  Private (Instructor)
const getInstructorMaterials = async (req, res) => {
  try {
    const { sectionId, materialType } = req.query;

    let filter = { instructor: req.user._id };

    if (sectionId) {
      filter.section = sectionId;
    }

    if (materialType) {
      filter.materialType = materialType;
    }

    const materials = await Material.find(filter)
      .populate('course', 'code title')
      .populate('section', 'sectionName')
      .sort({ uploadedAt: -1 });

    res.json(materials);
  } catch (error) {
    console.error('getInstructorMaterials error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update material
// @route   PUT /api/instructor/materials/:id
// @access  Private (Instructor)
const updateMaterial = async (req, res) => {
  try {
    const { title, description, materialType } = req.body;
    const materialId = req.params.id;

    const material = await Material.findById(materialId);

    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Check if the logged-in user is the instructor who uploaded this material
    if (material.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Not authorized to update this material'
      });
    }

    // Update fields
    if (title) material.title = title;
    if (description !== undefined) material.description = description;
    if (materialType) material.materialType = materialType;

    await material.save();

    await material.populate([
      { path: 'course', select: 'code title' },
      { path: 'section', select: 'sectionName' }
    ]);

    res.json({
      message: 'Material updated successfully',
      material
    });
  } catch (error) {
    console.error('updateMaterial error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Replace material file
// @route   PUT /api/instructor/materials/:id/file
// @access  Private (Instructor)
const replaceMaterialFile = async (req, res) => {
  try {
    const materialId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ message: 'New file is required' });
    }

    const material = await Material.findById(materialId);

    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Check if the logged-in user is the instructor who uploaded this material
    if (material.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Not authorized to update this material'
      });
    }

    // Delete old file
    if (fs.existsSync(material.filePath)) {
      fs.unlinkSync(material.filePath);
    }

    // Update with new file
    material.fileName = req.file.originalname;
    material.filePath = req.file.path;
    material.fileSize = req.file.size;
    material.mimeType = req.file.mimetype;

    await material.save();

    res.json({
      message: 'Material file replaced successfully',
      material: {
        _id: material._id,
        fileName: material.fileName,
        fileSize: material.fileSize,
        mimeType: material.mimeType,
      }
    });
  } catch (error) {
    console.error('replaceMaterialFile error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete material
// @route   DELETE /api/instructor/materials/:id
// @access  Private (Instructor)
const deleteMaterial = async (req, res) => {
  try {
    const materialId = req.params.id;

    const material = await Material.findById(materialId);

    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Check if the logged-in user is the instructor who uploaded this material
    if (material.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Not authorized to delete this material'
      });
    }

    // Delete file from filesystem
    if (fs.existsSync(material.filePath)) {
      fs.unlinkSync(material.filePath);
    }

    // Delete from database
    await Material.findByIdAndDelete(materialId);

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('deleteMaterial error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get materials for a section (Students)
// @route   GET /api/student/materials/section/:sectionId
// @access  Private (Student)
const getSectionMaterials = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { materialType } = req.query;

    const Student = require('../models/Student');
    const student = await Student.findOne({ user: req.user._id });

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    // Verify student is enrolled in this section
    const enrollment = await Enrollment.findOne({
      student: student._id,
      section: sectionId,
      status: 'Enrolled'
    });

    if (!enrollment) {
      return res.status(403).json({
        message: 'You are not enrolled in this section'
      });
    }

    let filter = { section: sectionId };

    if (materialType) {
      filter.materialType = materialType;
    }

    const materials = await Material.find(filter)
      .populate('course', 'code title')
      .populate('section', 'sectionName')
      .populate('instructor', 'name')
      .sort({ uploadedAt: -1 });

    res.json(materials);
  } catch (error) {
    console.error('getSectionMaterials error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Download material file
// @route   GET /api/materials/download/:id
// @access  Private (Student/Instructor)
const downloadMaterial = async (req, res) => {
  try {
    const materialId = req.params.id;

    const material = await Material.findById(materialId);

    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Check permissions based on user role
    if (req.user.role === 'STUDENT') {
      const Student = require('../models/Student');
      const student = await Student.findOne({ user: req.user._id });

      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      // Verify student is enrolled in the section
      const enrollment = await Enrollment.findOne({
        student: student._id,
        section: material.section,
        status: 'Enrolled'
      });

      if (!enrollment) {
        return res.status(403).json({
          message: 'You are not enrolled in this section'
        });
      }
    } else if (req.user.role === 'INSTRUCTOR') {
      // Verify instructor owns this material
      if (material.instructor.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: 'Not authorized to access this material'
        });
      }
    }

    // Check if file exists
    if (!fs.existsSync(material.filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', material.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${material.fileName}"`);

    // Stream the file
    const fileStream = fs.createReadStream(material.filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('downloadMaterial error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  upload,
  uploadMaterial,
  getInstructorMaterials,
  updateMaterial,
  replaceMaterialFile,
  deleteMaterial,
  getSectionMaterials,
  downloadMaterial
};