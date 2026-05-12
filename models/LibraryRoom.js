const mongoose = require('mongoose');

const libraryRoomSchema = new mongoose.Schema({
  library: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['Study Room', 'Computer Desk'], required: true },
  capacity: { type: Number, default: 1 },
  location: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const roomBookingSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryRoom', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  library: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  status: { type: String, enum: ['Confirmed', 'Cancelled', 'Completed'], default: 'Confirmed' },
}, { timestamps: true });

const LibraryRoom = mongoose.model('LibraryRoom', libraryRoomSchema);
const RoomBooking = mongoose.model('RoomBooking', roomBookingSchema);

module.exports = { LibraryRoom, RoomBooking };