const mongoose = require('mongoose');

const systemConfigSchema = mongoose.Schema(
  {
    universityName: {
      type: String,
      default: 'University of Gondar',
    },
    shortName: {
      type: String,
      default: 'UoG',
    },
    logoUrl: String,
    primaryColor: {
      type: String,
      default: '#143B7A', // Default Deep Blue
    },
    secondaryColor: {
      type: String,
      default: '#E67E22', // Default Orange
    },
    contactEmail: String,
    integrations: {
      type: Map,
      of: String,
      default: {
        'GOOGLE_MAPS_KEY': '',
        'SMS_GATEWAY_URL': '',
        'PAYMENT_GATEWAY_ID': '',
      },
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    allowedDomains: [String],
    gradingScale: {
      type: Map,
      of: Number, // e.g., { "A": 4.0, "B": 3.0 }
    },
    lastBackupAt: Date,
    configSetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
