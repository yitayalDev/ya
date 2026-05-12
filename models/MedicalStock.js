const mongoose = require('mongoose');

const medicalStockSchema = new mongoose.Schema({
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['Antibiotics', 'Painkillers', 'First Aid', 'Chronic', 'General', 'TABLET', 'SYRUP', 'INJECTION', 'CREAM', 'EQUIPMENT', 'OTHER'],
    default: 'General'
  },
  unit: {
    type: String,
    default: 'PCS'
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  minStockLevel: {
    type: Number,
    default: 10
  },
  pricePerUnit: {
    type: Number,
    default: 0
  },
  expiryDate: Date,
  batchNumber: String,
  supplier: String,
  location: String // e.g., Shelf A-1
}, { timestamps: true });

module.exports = mongoose.model('MedicalStock', medicalStockSchema);
