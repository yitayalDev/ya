const mongoose = require('mongoose');

const gradeAuditLogSchema = mongoose.Schema(
  {
    finalGrade: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinalGrade',
      required: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'CREATE_DRAFT',
        'UPDATE_DRAFT',
        'SUBMIT',
        'DEPARTMENT_APPROVE',
        'DEPARTMENT_REJECT',
        'REGISTRAR_APPROVE',
        'REGISTRAR_REJECT',
        'LOCK',
        'OVERRIDE',
        'GRADE_MODERATION',
        'BULK_UPLOAD',
      ],
      required: true,
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient lookups
gradeAuditLogSchema.index({ finalGrade: 1, createdAt: -1 });
gradeAuditLogSchema.index({ user: 1, createdAt: -1 });
gradeAuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('GradeAuditLog', gradeAuditLogSchema);
