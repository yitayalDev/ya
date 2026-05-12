const mongoose = require('mongoose');

const materialSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a material title'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    materialType: {
      type: String,
      enum: ['Lecture Note', 'Assignment', 'Lab', 'Reference'],
      required: [true, 'Please specify material type'],
    },
    fileName: {
      type: String,
      required: [true, 'Please add a file name'],
    },
    filePath: {
      type: String,
      required: [true, 'Please add a file path'],
    },
    fileSize: {
      type: Number,
      required: [true, 'Please add file size'],
    },
    mimeType: {
      type: String,
      required: [true, 'Please add mime type'],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
materialSchema.index({ section: 1, course: 1 });
materialSchema.index({ instructor: 1 });

module.exports = mongoose.model('Material', materialSchema);