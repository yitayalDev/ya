const mongoose = require('mongoose');

const bookLoanSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  library: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  returnDate: { type: Date },
  status: { type: String, enum: ['Issued', 'Returned', 'Overdue'], default: 'Issued' },
  fineAmount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('BookLoan', bookLoanSchema);
