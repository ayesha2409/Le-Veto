// server/models/settings.js
const mongoose = require('mongoose');

const DaySchema = new mongoose.Schema(
  {
    open:   { type: String, default: '' },   // "08:30"
    close:  { type: String, default: '' },   // "17:00"
    closed: { type: Boolean, default: false }
  },
  { _id: false }
);

const ImagesSchema = new mongoose.Schema(
  {
    hero: { type: String, default: '' },
    services: { type: Map, of: String, default: {} }
  },
  { _id: false }
);

const SettingsSchema = new mongoose.Schema(
  {
    clinic: {
      name: { type: String, default: 'Le Veto Clinic' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    // Full week + closed toggle per day
    businessHours: {
      sun: { type: DaySchema, default: () => ({}) },
      mon: { type: DaySchema, default: () => ({}) },
      tue: { type: DaySchema, default: () => ({}) },
      wed: { type: DaySchema, default: () => ({}) },
      thu: { type: DaySchema, default: () => ({}) },
      fri: { type: DaySchema, default: () => ({}) },
      sat: { type: DaySchema, default: () => ({}) },
    },
    // Specific dates you want fully closed (e.g. today only)
    holidays: { type: [String], default: [] }, // "YYYY-MM-DD"

    images: { type: ImagesSchema, default: () => ({}) }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', SettingsSchema);
