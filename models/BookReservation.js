const mongoose = require('mongoose');

const bookReservationSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  library: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Ready', 'Fulfilled', 'Cancelled'], 
    default: 'Pending' 
  },
  notifiedAt: { type: Date },
  expiresAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('BookReservation', bookReservationSchema);