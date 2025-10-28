const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pet:  { type: mongoose.Schema.Types.ObjectId, ref: 'Pet' },
  petName: String,
  name: String,
  email: String,
  phone: String,
  serviceType: String,
  date: String,
  time: String,
  notes: String,
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', AppointmentSchema);
