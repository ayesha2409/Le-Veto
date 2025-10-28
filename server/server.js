// server/server.js
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer');

const Pet         = require('./models/pet');
const Appointment = require('./models/Appointment');
const Settings    = require('./models/settings');
const User        = require('./models/user');

// ---- Mailer (safe stub if lib/mailer not present) ----
let Mailer;
try {
  Mailer = require('./lib/mailer');
} catch {
  Mailer = {
    async sendAppointmentConfirmed(p) { console.log('[mailer:stub] confirm', p); },
    async sendAppointmentCancelled(p) { console.log('[mailer:stub] cancel', p); },
  };
}
const { sendAppointmentConfirmed, sendAppointmentCancelled } = Mailer;

// ---- Env ----
const { PORT = 5000, MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!MONGODB_URI) { console.error('Missing MONGODB_URI in .env'); process.exit(1); }
if (!JWT_SECRET)   { console.error('Missing JWT_SECRET in .env');   process.exit(1); }

// ---- App ----
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:5501',
      'http://127.0.0.1:5501',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    credentials: false,
  })
);

// ---- DB ----
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// ---- Uploads ----
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, safe);
  },
});
const upload = multer({ storage });

// ---- Auth helpers ----
function signToken(payload, opts = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', ...opts });
}

function authGuard(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, error: 'Missing token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function adminGuard(req, res, next) {
  authGuard(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }
    next();
  });
}

// ---- Health ----
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---- Auth (User) ----
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name = '', phone = '' } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const exists = await User.findOne({ email: String(email).toLowerCase() }).lean();
    if (exists) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }
    const user = await User.create({ email, password, name, phone });
    const accessToken = signToken({ sub: String(user._id), email: user.email, role: 'user' });
    res.json({
      success: true,
      accessToken,
      user: { id: user._id, email: user.email, name: user.name, phone: user.phone },
    });
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ success: false, error: 'Email already registered' });
    console.error(e);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

app.post('/api/auth/user-login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ success: false, error: 'No account with this email' });

    const ok = await user.comparePassword(password || '');
    if (!ok) return res.status(401).json({ success: false, error: 'Incorrect password' });

    const accessToken = signToken({ sub: String(user._id), email: user.email, role: 'user' });
    res.json({
      success: true,
      accessToken,
      user: { id: user._id, email: user.email, name: user.name, phone: user.phone },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ---- Me ----
app.get('/api/me', authGuard, async (req, res) => {
  try {
    const user = await User.findById(req.user?.sub).lean();
    if (!user) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        photoUrl: user.photoUrl || '',
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Failed to load profile' });
  }
});

app.patch('/api/me', authGuard, async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body?.name === 'string')  updates.name  = req.body.name;
    if (typeof req.body?.phone === 'string') updates.phone = req.body.phone;

    const user = await User.findByIdAndUpdate(req.user.sub, updates, { new: true }).lean();
    if (!user) return res.status(404).json({ success: false, error: 'Not found' });

    res.json({
      success: true,
      user: { id: user._id, email: user.email, name: user.name, phone: user.phone, photoUrl: user.photoUrl || '' },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

app.post('/api/me/photo', authGuard, upload.single('file'), async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ success: false, error: 'Not found' });

    if (user.photoUrl) {
      const oldPath = path.join(__dirname, user.photoUrl.replace(/^\/uploads\//, 'uploads/'));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.photoUrl = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({ success: true, url: user.photoUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Failed to upload photo' });
  }
});

app.delete('/api/me/photo', authGuard, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ success: false, error: 'Not found' });

    const old = user.photoUrl;
    user.photoUrl = '';
    await user.save();

    if (old) {
      const oldPath = path.join(__dirname, old.replace(/^\/uploads\//, 'uploads/'));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Failed to remove photo' });
  }
});


// ======================= MY PETS (user-side) =======================
app.get('/api/me/pets', authGuard, async (req, res) => {
  const ownerId = req.user.sub;
  const rows = await Pet.find({ owner: ownerId }).sort({ createdAt: -1 }).lean();
  res.json(rows.map(p => ({
    _id: String(p._id),
    name: p.name,
    species: p.species || '',
    breed: p.breed || '',
    sex: p.sex || '',
    dob: p.dob || '',
    avatarUrl: p.avatarUrl || ''
  })));
});

app.post('/api/me/pets', authGuard, async (req, res) => {
  const ownerId = req.user.sub;
  const { name, species, breed = '', sex = '', dob = '' } = req.body || {};
  if (!name || !species) return res.status(400).json({ error: 'Name and species are required' });

  const p = await Pet.create({ owner: ownerId, name, species, breed, sex, dob });
  res.json({
    _id: String(p._id),
    name: p.name, species: p.species, breed: p.breed, sex: p.sex, dob: p.dob, avatarUrl: p.avatarUrl || ''
  });
});

app.patch('/api/me/pets/:id', authGuard, async (req, res) => {
  const ownerId = req.user.sub;
  const { id } = req.params;
  const updates = {};
  ['name','species','breed','sex','dob'].forEach(k => {
    if (typeof req.body?.[k] === 'string') updates[k] = req.body[k];
  });

  const p = await Pet.findOneAndUpdate({ _id: id, owner: ownerId }, updates, { new: true }).lean();
  if (!p) return res.status(404).json({ error: 'Not found' });

  res.json({
    _id: String(p._id),
    name: p.name, species: p.species, breed: p.breed, sex: p.sex, dob: p.dob, avatarUrl: p.avatarUrl || ''
  });
});

app.delete('/api/me/pets/:id', authGuard, async (req, res) => {
  const ownerId = req.user.sub;
  const { id } = req.params;
  const p = await Pet.findOneAndDelete({ _id: id, owner: ownerId });
  if (!p) return res.status(404).json({ error: 'Not found' });

  // remove avatar file if any
  if (p.avatarUrl) {
    const oldPath = path.join(__dirname, p.avatarUrl.replace(/^\/uploads\//, 'uploads/'));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  res.json({ success: true });
});

app.post('/api/me/pets/:id/avatar', authGuard, upload.single('file'), async (req, res) => {
  const ownerId = req.user.sub;
  const { id } = req.params;

  const p = await Pet.findOne({ _id: id, owner: ownerId });
  if (!p) return res.status(404).json({ error: 'Not found' });

  if (p.avatarUrl) {
    const oldPath = path.join(__dirname, p.avatarUrl.replace(/^\/uploads\//, 'uploads/'));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  p.avatarUrl = `/uploads/${req.file.filename}`;
  await p.save();
  res.json({ success: true, url: p.avatarUrl });
});



app.get('/api/me/appointments', authGuard, async (req, res) => {
  try {
    const email = req.user.email;
    const items = await Appointment.find({ email }).sort({ date: 1, time: 1 }).lean();
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load appointments' });
  }
});

// ---- Admin Auth ----
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const accessToken = signToken({ sub: 'admin', email, role: 'admin' });
    return res.json({ success: true, accessToken });
  }
  return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
});

// ---- Settings helpers ----
async function ensureSettings() {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  return s;
}

// ======================= SETTINGS (admin + public) =======================
app.get('/api/settings', async (req, res, next) => {
  try {
    const s = await Settings.findOne({}).lean();
    res.json({
      settings: s || { businessHours: {}, holidays: [], images: { hero: '', services: {} } },
    });
  } catch (err) { next(err); }
});

app.patch('/api/settings', async (req, res, next) => {
  try {
    const s = await Settings.findOneAndUpdate({}, req.body, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }).lean();
    res.json({ settings: s });
  } catch (err) { next(err); }
});

// public settings for homepage
app.get('/api/public/settings', async (_req, res) => {
  const s = await ensureSettings();
  const out = s.toObject();
  res.json({
    success: true,
    clinic: out.clinic,
    businessHours: out.businessHours,
    holidays: out.holidays,
    images: out.images,
  });
});

// Uploads for content images (admin)
app.post('/api/uploads/hero', adminGuard, upload.single('file'), async (req, res) => {
  const s = await ensureSettings();
  s.images.hero = `/uploads/${req.file.filename}`;
  await s.save();
  res.json({ success: true, url: s.images.hero });
});

app.post('/api/uploads/service/:key', adminGuard, upload.single('file'), async (req, res) => {
  const valid = ['card1', 'card2', 'card3'];
  const key = String(req.params.key || '').toLowerCase();
  if (!valid.includes(key)) return res.status(400).json({ success: false, error: 'Invalid service key' });
  const s = await ensureSettings();
  s.images.services = s.images.services || {};
  s.images.services[key] = `/uploads/${req.file.filename}`;
  await s.save();
  res.json({ success: true, url: s.images.services[key], key });
});

// ---- Google reviews (public) ----
app.get('/api/public/google-reviews', async (_req, res) => {
  try {
    const apiKey   = process.env.GOOGLE_PLACES_API_KEY;
    const placeId  = process.env.GOOGLE_PLACE_ID;
    if (!apiKey || !placeId) {
      return res.status(500).json({ success:false, error: 'Google Places not configured' });
    }

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
    const r = await fetch(url, {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews' }
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('Places API error:', data);
      return res.status(r.status).json({ success:false, error: data?.error?.message || 'Google error' });
    }

    const reviews = (data.reviews || [])
      .map(rv => ({
        rating: rv.rating || 0,
        text: rv.text?.text || '',
        author: rv.authorAttribution?.displayName || 'Google user',
        time: rv.publishTime || ''
      }))
      .filter(x => x.text);

    res.json({ success:true, reviews });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, error:'Failed to fetch reviews' });
  }
});

// ======================= APPOINTMENTS (admin) =======================
app.get('/api/appointments', adminGuard, async (req, res) => {
  const { date, service, status, q, limit = 200 } = req.query || {};
  const filter = {};
  if (date) filter.date = String(date);
  if (service) filter.serviceType = String(service);
  if (status) filter.status = String(status);
  if (q) {
    const r = new RegExp(String(q), 'i');
    filter.$or = [{ name: r }, { email: r }, { petName: r }, { serviceType: r }];
  }
  const items = await Appointment.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(1000, Number(limit)))).lean();
  res.json(items);
});

app.patch('/api/appointments/:id', adminGuard, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const appt = await Appointment.findByIdAndUpdate(id, { status }, { new: true }).lean();
  if (!appt) return res.status(404).json({ success: false, error: 'Not found' });

  try {
    if (status === 'confirmed') await sendAppointmentConfirmed({ to: appt.email });
    if (status === 'cancelled') await sendAppointmentCancelled({ to: appt.email });
  } catch (e) {
    console.log('[mailer] error:', e.message);
  }

  res.json({ success: true, data: appt });
});

// CSV export
app.get('/api/appointments/export.csv', adminGuard, async (req, res) => {
  const { date, service, status, q } = req.query || {};
  const filter = {};
  if (date) filter.date = String(date);
  if (service) filter.serviceType = String(service);
  if (status) filter.status = String(status);
  if (q) {
    const r = new RegExp(String(q), 'i');
    filter.$or = [{ name: r }, { email: r }, { petName: r }, { serviceType: r }];
  }
  const items = await Appointment.find(filter).sort({ createdAt: -1 }).lean();
  const cols = ['createdAt', 'date', 'time', 'serviceType', 'name', 'email', 'phone', 'petName', 'status'];
  const header = cols.join(',') + '\n';
  const rows = items
    .map((x) =>
      cols
        .map((c) => {
          const v = x[c] ?? '';
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(',')
    )
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="appointments.csv"');
  res.send(header + rows);
});

app.get('/api/appointments/summary', adminGuard, async (req, res) => {
  const range = Math.max(1, Math.min(60, Number(req.query.range) || 7));
  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);
  const items = await Appointment.find({ createdAt: { $gte: since } }).lean();
  const sum = { total: items.length, pending: 0, confirmed: 0, cancelled: 0 };
  for (const a of items) {
    if (sum[a.status] != null) sum[a.status]++;
  }
  res.json(sum);
});

// ======================= USERS & PETS (admin) =======================
app.get('/api/users', adminGuard, async (req, res) => {
  const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 200));
  const data = await User.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    { $lookup: { from: 'pets', localField: '_id', foreignField: 'owner', as: 'pets' } },
    { $addFields: { petsCount: { $size: '$pets' } } },
    { $project: { name: 1, email: 1, phone: 1, createdAt: 1, petsCount: 1 } },
  ]);
  res.json(data);
});

// Pets list (admin) — placed BEFORE user pet routes to avoid conflicts
app.get('/api/pets', adminGuard, async (_req, res) => {
  const items = await Pet.find({}).sort({ createdAt: -1 }).populate('owner', 'name email phone').lean();
  res.json(
    items.map((p) => ({
      id: p._id,
      name: p.name,
      species: p.species,
      breed: p.breed,
      dob: p.dob,
      ownerName: p.owner?.name || '',
      ownerEmail: p.owner?.email || '',
      ownerPhone: p.owner?.phone || '',
      avatarUrl: p.avatarUrl || '',
      reports: p.medicalReports?.length || 0,
    }))
  );
});

// Pet details (admin)
app.get('/api/pets/:id', adminGuard, async (req, res) => {
  const p = await Pet.findById(req.params.id)
    .populate('owner', 'name email phone')
    .lean();
  if (!p) return res.status(404).json({ error: 'Not found' });

  res.json({
    id: String(p._id),
    name: p.name,
    species: p.species || '',
    breed: p.breed || '',
    dob: p.dob || '',
    owner: p.owner || null,
    reports: p.medicalReports || [],
    // ⬇️ add this line
    avatarUrl: p.avatarUrl || ''
  });
});

// Upload medical report (admin)
app.post('/api/pets/:id/reports', adminGuard, upload.single('file'), async (req, res) => {
  const p = await Pet.findById(req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Not found' });
  const report = {
    fileId: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  };
  p.medicalReports.push(report);
  await p.save();
  res.json({ success: true, report });
});

// Download medical report (admin)
app.get('/api/pets/:id/reports/:fileId', adminGuard, async (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.fileId);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.download(filePath, req.params.fileId);
});

// Delete medical report (admin)
app.delete('/api/pets/:id/reports/:fileId', adminGuard, async (req, res) => {
  const p = await Pet.findById(req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Not found' });
  p.medicalReports = p.medicalReports.filter((r) => r.fileId !== req.params.fileId);
  await p.save();
  const filePath = path.join(UPLOAD_DIR, req.params.fileId);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

// ======================= APPOINTMENTS (public booking) =======================
app.post('/api/appointments/book', async (req, res) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;

    let userEmail = null;
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmail = decoded.email;
        userId = decoded.sub;
      } catch { /* ignore bad token */ }
    }

    const { name, email, phone, petName, serviceType, date, time, message } = req.body || {};
    const finalEmail = userEmail || email;

    if (!name || !finalEmail || !serviceType || !date || !time) {
      return res.status(400).json({ success:false, error:'Missing required fields' });
    }

   // ---- HOURS & HOLIDAYS GUARD ----
const s = await Settings.findOne({}).lean();
const holidays = s?.holidays || [];
const bh = s?.businessHours || {};

if (holidays.includes(String(date))) {
  return res.status(400).json({ success:false, error:'Clinic is closed on the selected date (holiday).' });
}

const dayKeyMap = ['sun','mon','tue','wed','thu','fri','sat'];
const dt = new Date(`${date}T00:00:00`);
const wkey = dayKeyMap[dt.getDay()];

const hours = bh?.[wkey];
if (!hours || hours.closed || !hours.open || !hours.close) {
  return res.status(400).json({ success:false, error:'Clinic is closed on the selected day.' });
}

const toMinutes = (t) => {
  let m = String(t).trim().toLowerCase();
  const ampm = m.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (ampm) {
    let hh = (parseInt(ampm[1],10) % 12) + (ampm[3] === 'pm' ? 12 : 0);
    return hh * 60 + parseInt(ampm[2],10);
  }
  const hhmm = m.match(/^(\d{2}):(\d{2})$/);
  if (hhmm) return parseInt(hhmm[1],10)*60 + parseInt(hhmm[2],10);
  return NaN;
};

const openM  = toMinutes(hours.open);
const closeM = toMinutes(hours.close);
const whenM  = toMinutes(time);

if (Number.isNaN(openM) || Number.isNaN(closeM) || Number.isNaN(whenM)) {
  return res.status(400).json({ success:false, error:'Invalid time format.' });
}
if (whenM < openM || whenM >= closeM) {
  return res.status(400).json({ success:false, error:`Please choose a time between ${hours.open} and ${hours.close}.` });
}


    // create appointment
    const appt = await Appointment.create({
      name,
      email: finalEmail,
      userId,
      phone,
      petName,
      serviceType,
      date,
      time,
      notes: message,
      status: 'pending'
    });

    res.json({ success:true, data: appt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, error:'Failed to create appointment' });
  }
});

// ======================= ERROR HANDLER =======================
app.use((err, req, res, next) => {
  console.error('[Server Error]', err && err.stack || err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));
process.on('uncaughtException',  err => console.error('[uncaughtException]',  err));

// ---- Start ----
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
