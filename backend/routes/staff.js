'use strict';

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

// ── DB-backed session store ───────────────────────────────────────────────
function getSession(staffId) {
  try {
    return db.prepare('SELECT token FROM staff_sessions WHERE staff_id = ?').get(staffId);
  } catch { return null; }
}

function setSession(staffId, token) {
  try {
    db.prepare('INSERT OR REPLACE INTO staff_sessions (staff_id, token, created_at) VALUES (?, ?, ?)')
      .run(staffId, token, new Date().toISOString());
  } catch {}
}

function deleteSession(staffId) {
  try {
    db.prepare('DELETE FROM staff_sessions WHERE staff_id = ?').run(staffId);
  } catch {}
}

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

// ── PIN duplicate check ───────────────────────────────────────────────────
// Checks all active staff (excluding the one being updated) to see if the
// given raw PIN already matches any existing hashed/plain PIN.
async function isPinTaken(rawPin, excludeId = null) {
  const allStaff = db.prepare('SELECT id, pin FROM staff WHERE active = 1').all();
  for (const s of allStaff) {
    if (excludeId !== null && s.id === excludeId) continue;
    const match = await verifyPin(rawPin, s.pin);
    if (match) return true;
  }
  return false;
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

  if (await isPinTaken(pin)) {
    return res.status(409).json({
      error: 'This PIN is already in use by another staff member. Please choose a different PIN.'
    });
  }

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
    const excludeId = parseInt(req.params.id, 10);
    if (await isPinTaken(pin, excludeId)) {
      return res.status(409).json({
        error: 'This PIN is already in use by another staff member. Please choose a different PIN.'
      });
    }
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

  deleteSession(member.id);
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/staff/verify — login: checks PIN, enforces single-session, returns sessionToken
router.post('/verify', async (req, res) => {
  const { pin, currentSessionToken } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN required' });

  const allStaff = db.prepare('SELECT id, name, role, pin FROM staff WHERE active = 1').all();
  for (const s of allStaff) {
    const match = await verifyPin(pin, s.pin);
    if (match) {
      const existing = getSession(s.id);
      if (existing) {
        const isSameDevice = currentSessionToken && existing.token === currentSessionToken;
        const clientHasNoToken = !currentSessionToken;
        if (!isSameDevice && !clientHasNoToken) {
          return res.status(409).json({
            error: `"${s.name}" is already logged in on another device. Log out there first.`,
            staffName: s.name,
          });
        }
      }
      const sessionToken = crypto.randomBytes(24).toString('hex');
      setSession(s.id, sessionToken);
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
  const stored = getSession(id);
  if (stored && stored.token === sessionToken) {
    deleteSession(id);
  }
  res.json({ success: true });
});

// GET /api/staff/session/validate — heartbeat; returns {valid: bool}
router.get('/session/validate', (req, res) => {
  const staffId = Number(req.query.staffId);
  const token   = req.query.sessionToken;
  if (!staffId || !token) return res.json({ valid: false });
  const stored = getSession(staffId);
  res.json({ valid: !!(stored && stored.token === token) });
});

// POST /api/staff/check-pin — verify an admin PIN WITHOUT touching sessions.
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