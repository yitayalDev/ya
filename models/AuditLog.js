const mongoose = require('mongoose');

const auditLogSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    module: {
      type: String,
      required: true,
      enum: ['ACADEMIC_CALENDAR', 'CAMPUS_TRANSFER', 'ENROLLMENT', 'GRADES', 'STUDENT_MANAGEMENT', 'USER_MANAGEMENT', 'SYSTEM_CONFIG', 'ACADEMIC_POLICIES'],
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    method: {
      type: String,
    },
    path: {
      type: String,
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

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
