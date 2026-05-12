const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  isbn: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  library: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
  totalCopies: { type: Number, default: 1 },
  availableCopies: { type: Number, default: 1 },
  location: { type: String },
  status: { type: String, enum: ['Available', 'OutOfStock', 'Archived'], default: 'Available' },
  hasDigitalVersion: { type: Boolean, default: false },
  digitalContent: {
    type: { type: String, enum: ['pdf', 'link', 'none'], default: 'none' },
    url: { type: String },
    description: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);
