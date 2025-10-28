const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  fileId: { type: String, required: true }, 
  mimeType: String,
  size: Number,
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const PetSchema = new mongoose.Schema({
  owner:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:    { type: String, required: true },
  species: { type: String, default: '' },
  breed:   { type: String, default: '' },
  sex:     { type: String, default: '' },
  dob:     { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  medicalReports: { type: [ReportSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Pet', PetSchema);
