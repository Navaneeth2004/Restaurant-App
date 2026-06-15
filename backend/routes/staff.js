const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (_) {
  console.warn('[staff] bcryptjs not installed — PINs compared in plaintext until you run npm install');
  bcrypt = null;
}

const SALT_ROUNDS = 10;

// ── In-memory session store ───────────────────────────────────────────────
// Maps staffId (number) → session token string.
// Only one active session per staff member is allowed at a time.
const activeSessions = new Map();

async function hashPin(pin) {
  if (!bcrypt) return pin;
  return bcrypt.hash(String(pin), SALT_ROUNDS);
}

async function verifyPin(raw, stored) {
  if (!bcrypt) return String(raw) === String(stored);
  if (stored && (stored.startsWith('$2a$') || stored.startsWith('$2b$'))) {
    return bcrypt.compare(String(raw), stored);
  }
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
  if (pin) hashedPin = await hashPin(pin);

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
  const member = db.prepare('SELECT id, name, role FROM staff WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Staff member not found' });

  if (member.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM staff WHERE role = 'admin' AND active = 1").get().c;
    if (adminCount <= 1) {
      return res.status(400).json({
        error: 'Cannot delete the last admin account. Add another admin first.'
      });
    }
  }

  // Clear any active session before deleting
  activeSessions.delete(member.id);
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/staff/verify — login: checks PIN, enforces single-session, returns sessionToken
router.post('/verify', async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN required' });

  const allStaff = db.prepare('SELECT id, name, role, pin FROM staff WHERE active = 1').all();
  for (const s of allStaff) {
    const match = await verifyPin(pin, s.pin);
    if (match) {
      // Block if this account already has an active session on another device
      if (activeSessions.has(s.id)) {
        return res.status(409).json({
          error: `"${s.name}" is already logged in on another device. Log out there first.`,
          staffName: s.name,
        });
      }
      const sessionToken = crypto.randomBytes(24).toString('hex');
      activeSessions.set(s.id, sessionToken);
      return res.json({ id: s.id, name: s.name, role: s.role, sessionToken });
    }
  }
  return res.status(401).json({ error: 'Invalid PIN' });
});

// POST /api/staff/logout — free the session slot
router.post('/logout', (req, res) => {
  const { staffId, sessionToken } = req.body;
  if (!staffId) return res.status(400).json({ error: 'staffId required' });
  const id = Number(staffId);
  const stored = activeSessions.get(id);
  // Only clear if token matches — prevents a different device clearing someone else's slot
  if (stored && stored === sessionToken) {
    activeSessions.delete(id);
  }
  res.json({ success: true });
});

// GET /api/staff/session/validate — heartbeat; returns {valid: bool}
router.get('/session/validate', (req, res) => {
  const staffId = Number(req.query.staffId);
  const token   = req.query.sessionToken;
  if (!staffId || !token) return res.json({ valid: false });
  const stored = activeSessions.get(staffId);
  res.json({ valid: stored === token });
});

// POST /api/staff/check-pin — verify an admin PIN WITHOUT touching sessions.
// Used by the admin lock modal so it never conflicts with the active login session.
router.post('/check-pin', async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN required' });
  const admins = db.prepare("SELECT pin FROM staff WHERE role = 'admin' AND active = 1").all();
  for (const a of admins) {
    const match = await verifyPin(pin, a.pin);
    if (match) return res.json({ valid: true });
  }
  return res.json({ valid: false });
});

module.exports = router;