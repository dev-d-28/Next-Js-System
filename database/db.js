/**
 * Database — Pure JSON file storage. No npm packages needed.
 * All data lives in database/data.json and is loaded into memory on startup.
 */

const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const BUNDLED_DATA_FILE = path.join(__dirname, 'data.json');
const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'data.json')
  : BUNDLED_DATA_FILE;

// In Vercel serverless environment, copy the bundled database to /tmp if it doesn't exist
if (process.env.VERCEL && !fs.existsSync(DATA_FILE) && fs.existsSync(BUNDLED_DATA_FILE)) {
  try {
    fs.copyFileSync(BUNDLED_DATA_FILE, DATA_FILE);
  } catch (err) {
    console.error('Failed to copy bundled data.json to /tmp:', err);
  }
}

// ── In-memory state ──────────────────────────────────────────────────────────
let _data = {
  users:         [],
  clients:       [],
  invoices:      [],
  invoice_items: [],
  settings:      {},
  _seq:          { users: 0, clients: 0, invoices: 0, invoice_items: 0 }
};

// ── Persistence ──────────────────────────────────────────────────────────────
function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(_data, null, 2), 'utf8');
}

function load() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      _data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      // Ensure _seq exists (backward compat)
      if (!_data._seq) _data._seq = { users: 0, clients: 0, invoices: 0, invoice_items: 0 };
    } catch (e) {
      console.warn('Warning: Could not parse data.json, starting fresh.');
    }
  }
}

// ── ID generator ─────────────────────────────────────────────────────────────
function nextId(table) {
  _data._seq[table] = (_data._seq[table] || 0) + 1;
  return _data._seq[table];
}

// ── CRUD helpers ─────────────────────────────────────────────────────────────
const db = {
  // Return all rows from a table
  all(table) {
    return _data[table] || [];
  },

  // Find one by id
  find(table, id) {
    return (_data[table] || []).find(r => String(r.id) === String(id));
  },

  // Find one by a field value
  findBy(table, field, value) {
    return (_data[table] || []).find(r => String(r[field]) === String(value));
  },

  // Filter rows
  filter(table, fn) {
    return (_data[table] || []).filter(fn);
  },

  // Insert a new row; returns the new row with assigned id
  insert(table, row) {
    const id  = nextId(table);
    const now = new Date().toISOString();
    const newRow = { id, created_at: now, updated_at: now, ...row };
    _data[table] = _data[table] || [];
    _data[table].push(newRow);
    save();
    return newRow;
  },

  // Update a row by id; returns updated row or null
  update(table, id, changes) {
    const idx = (_data[table] || []).findIndex(r => String(r.id) === String(id));
    if (idx === -1) return null;
    _data[table][idx] = { ..._data[table][idx], ...changes, updated_at: new Date().toISOString() };
    save();
    return _data[table][idx];
  },

  // Delete a row by id
  delete(table, id) {
    const before = (_data[table] || []).length;
    _data[table] = (_data[table] || []).filter(r => String(r.id) !== String(id));
    if (_data[table].length !== before) save();
    return before !== (_data[table] || []).length;
  },

  // Delete all rows matching a filter
  deleteWhere(table, fn) {
    _data[table] = (_data[table] || []).filter(r => !fn(r));
    save();
  },

  // Settings helpers
  getSetting(key) { return _data.settings[key]; },
  getAllSettings() { return { ..._data.settings }; },
  setSetting(key, value) { _data.settings[key] = value; save(); },
  setSettings(obj) { Object.assign(_data.settings, obj); save(); }
};

// ── Init: load file, seed defaults ───────────────────────────────────────────
async function initDatabase() {
  load();

  // Seed admin user
  if (!db.findBy('users', 'username', 'admin')) {
    db.insert('users', {
      username:      'admin',
      password_hash: bcrypt.hashSync('admin123', 10)
    });
    console.log('👤 Default admin user created (admin / admin123)');
  }

  // Seed default settings
  const defaults = {
    company_name:    'KEYUR DASADIYA',
    company_tagline: 'AT INDIGO FIRES',
    company_address: '123 Business Street',
    company_city:    'Ahmedabad, Gujarat - 380001',
    company_phone:   '+91 98765 43210',
    company_email:   'keyur@indigofires.com',
    company_website: 'www.indigofires.com',
    company_gstin:   '24AAAAA0000A1Z5',
    bank_name:       'Bonate National Bank',
    bank_account:    '1234 5678 9012',
    bank_ifsc:       'BONA0001234',
    bank_branch:     'Ahmedabad Main Branch',
    bank_upi:        'keyur@upi',
    currency:        '₹',
    currency_code:   'INR',
    tax_label:       'GST',
    invoice_prefix:  'INV',
    invoice_start:   '1001',
    logo_data:       '',
    theme_color:     '#1B1869'
  };

  for (const [key, val] of Object.entries(defaults)) {
    if (_data.settings[key] === undefined) db.setSetting(key, val);
  }

  console.log('✅ Database initialized (JSON file storage)');
}

module.exports = { initDatabase, db };
