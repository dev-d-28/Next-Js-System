/**
 * Auth Routes — Login, token verify, password change
 */

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { db }  = require('../database/db');

const router = express.Router();
const JWT_SECRET  = process.env.JWT_SECRET || 'invoice_gen_secret_2024_xK9p';
const JWT_EXPIRES = '7d';

// ── Exported middleware: verify JWT ───────────────────────────────────────────
function authenticateToken(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// ── POST /api/auth/login ───────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  const user = db.findBy('users', 'username', username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// ── GET /api/auth/verify ───────────────────────────────────────────────────────
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ── POST /api/auth/change-password ────────────────────────────────────────────
router.post('/change-password', authenticateToken, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Minimum 6 characters required' });

  const user = db.find('users', req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  db.update('users', req.user.id, { password_hash: bcrypt.hashSync(new_password, 10) });
  res.json({ message: 'Password changed successfully' });
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
