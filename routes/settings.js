/**
 * Settings Routes — company info, bank details, logo upload
 */

const express = require('express');
const multer = require('multer');
const { db } = require('../database/db');
const { authenticateToken } = require('./auth');

const router = express.Router();
router.use(authenticateToken);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

const ALLOWED_KEYS = [
  'company_name', 'company_tagline', 'company_address', 'company_city',
  'company_phone', 'company_email', 'company_website', 'company_gstin',
  'bank_name', 'bank_account', 'bank_ifsc', 'bank_branch', 'bank_upi',
  'currency', 'currency_code', 'tax_label', 'invoice_prefix', 'invoice_start', 'theme_color'
];

// GET /api/settings
router.get('/', (req, res) => res.json(db.getAllSettings()));

// PUT /api/settings
router.put('/', (req, res) => {
  const updates = {};
  for (const [k, v] of Object.entries(req.body)) {
    if (ALLOWED_KEYS.includes(k)) updates[k] = String(v);
  }
  db.setSettings(updates);
  res.json({ message: 'Settings saved' });
});

// POST /api/settings/logo
router.post('/logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  db.setSetting('logo_data', b64);
  res.json({ message: 'Logo uploaded', logo_data: b64 });
});

module.exports = router;    
