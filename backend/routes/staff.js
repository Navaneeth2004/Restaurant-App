const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ── bcrypt for PIN hashing ────────────────────────────────────────────────
// We use bcryptjs (pure JS, no C++ build tools needed) so it works
// everywhere sql.js works. Falls back gracefully if not installed yet.
let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (_) {
  // If bcryptjs isn't installed yet, warn once and use plaintext comparison
  // (safe fallback so existing installs keep working until npm install runs)
  console.warn('[staff] bcryptjs not installed — PINs compared in plaintext until you run npm install');
  bcrypt = null;
}

const SALT_ROUNDS = 10;

/** Hash a PIN string. Returns the hash (or the original string if bcrypt unavailable). */
async function hashPin(pin) {
  if (!bcrypt) return pin;
  return bcrypt.hash(String(pin), SALT_ROUNDS);
}

/**
 * Compare a raw PIN against a stored value that might be:
 *   - a bcrypt hash  ($2a$… / $2b$…)
 *   - plaintext      (legacy installs or fallback)
 */
async function verifyPin(raw, stored) {
  if (!bcrypt) return String(raw) === String(stored);
  // Detect bcrypt hash by prefix
  if (stored && (stored.startsWith('$2a$') || stored.startsWith('$2b$'))) {
    return bcrypt.compare(String(raw), stored);
  }
  // Plaintext legacy PIN — compare directly (will be upgraded on next change)
  return String(raw) === String(stored);
}

// GET all staff (never return the PIN)
router.get('/', (req, res) => {
  const staff = db.prepare('SELECT id, name, role, active FROM staff ORDER BY name').all();
  res.json(staff);
});

// POST create staff member
router.post('/', async (req, res) => {
  const { name, pin, role } = req.body;
  if (!name || !pin || !role) return res.status(400).json({ error: 'name, pin, role required' });

  const hashed = await hashPin(pin);
  const info = db.prepare('INSERT INTO staff (name, pin, role) VALUES (?, ?, ?)').run(name.trim(), hashed, role);
  const staff = db.prepare('SELECT id, name, role, active FROM staff WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(staff);
});

// PUT update staff member (supports PIN change)
router.put('/:id', async (req, res) => {
  const { name, pin, role, active } = req.body;

  let hashedPin = null;
  if (pin) {
    hashedPin = await hashPin(pin);
  }

  db.prepare(`
    UPDATE staff SET
      name   = COALESCE(?, name),
      pin    = COALESCE(?, pin),
      role   = COALESCE(?, role),
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    name   || null,
    hashedPin || null,
    role   || null,
    active !== undefined ? (active ? 1 : 0) : null,
    req.params.id
  );

  res.json({ success: true });
});

// DELETE staff member
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/staff/verify — check PIN at login
router.post('/verify', async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN required' });

  // Fetch all active staff and compare (bcrypt can't be done in SQL)
  const allStaff = db.prepare('SELECT id, name, role, pin FROM staff WHERE active = 1').all();

  for (const s of allStaff) {
    const match = await verifyPin(pin, s.pin);
    if (match) {
      return res.json({ id: s.id, name: s.name, role: s.role });
    }
  }

  return res.status(401).json({ error: 'Invalid PIN' });
});

module.exports = router;