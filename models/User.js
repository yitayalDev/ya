const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'REGISTRAR', 'INSTRUCTOR', 'STUDENT', 'LIBRARY_ADMIN', 'DORMITORY_ADMIN', 'PROCTOR', 'CLINIC_ADMIN', 'DOCTOR', 'PHARMACIST', 'NURSE', 'DEAN_OF_STUDENTS'],
      default: 'STUDENT',
    },
    college: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
    },
     assignedBuilding: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'DormBuilding',
     },
     assignedBlock: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'DormBlock',
     },
    currentStatus: {
      type: String,
      enum: ['INSIDE', 'OUTSIDE'],
      default: 'OUTSIDE',
    },
    lastScanTime: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
