/**
 * Client Routes — Full CRUD
 */

const express = require('express');
const { db }  = require('../database/db');
const { authenticateToken } = require('./auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/clients
router.get('/', (req, res) => {
  const { search } = req.query;
  let clients = db.all('clients');
  if (search) {
    const s = search.toLowerCase();
    clients = clients.filter(c =>
      c.name?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s)
    );
  }
  res.json(clients.sort((a, b) => a.name.localeCompare(b.name)));
});

// GET /api/clients/:id
router.get('/:id', (req, res) => {
  const client = db.find('clients', req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

// POST /api/clients
router.post('/', (req, res) => {
  const { name, address, city, state, pincode, phone, email, gstin } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Client name is required' });
  const client = db.insert('clients', { name: name.trim(), address: address||'', city: city||'', state: state||'', pincode: pincode||'', phone: phone||'', email: email||'', gstin: gstin||'' });
  res.status(201).json(client);
});

// PUT /api/clients/:id
router.put('/:id', (req, res) => {
  if (!db.find('clients', req.params.id)) return res.status(404).json({ error: 'Client not found' });
  const { name, address, city, state, pincode, phone, email, gstin } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Client name is required' });
  res.json(db.update('clients', req.params.id, { name: name.trim(), address: address||'', city: city||'', state: state||'', pincode: pincode||'', phone: phone||'', email: email||'', gstin: gstin||'' }));
});

// DELETE /api/clients/:id
router.delete('/:id', (req, res) => {
  if (!db.find('clients', req.params.id)) return res.status(404).json({ error: 'Client not found' });
  db.delete('clients', req.params.id);
  res.json({ message: 'Client deleted' });
});

module.exports = router;
