'use strict';
/**
 * /api/staff — staff accounts and the PIN login (barrier 2).
 *
 * CHANGES vs the single-restaurant version:
 *  - PIN login is rate-limited per device (5 wrong PINs = 5 minute lock).
 *  - A successful login sets the httpOnly "pos_staff" cookie; the server checks it on every request.
 *  - Role-locked devices (e.g. a kitchen tablet) only accept that role (admins can always log in).
 *  - Weak PINs (0000, 1234, 1111 ...) are refused.
 *  - PINs are always bcrypt hashes (no plain-text fallback).
 */
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const ctx = require('../core/context');
const cfg = require('../core/config');
const entitlements = require('../core/entitlements');
const { pinFails, verifyPin, lockMsg } = require('../core/pin-guard');
const { STAFF_COOKIE, cookieOptions } = require('../core/devices');
const { pinProblem } = require('../core/util');

const router = express.Router();
const SALT_ROUNDS = 10;

// ── helpers ───────────────────────────────────────────────────────────────
function getSession(staffId) {
  return db.prepare('SELECT token FROM staff_sessions WHERE staff_id = ?').get(staffId);
}
function setSession(staffId, token) {
  db.prepare('INSERT OR REPLACE INTO staff_sessions (staff_id, token, created_at) VALUES (?, ?, ?)')
    .run(staffId, token, new Date().toISOString());
}
function deleteSession(staffId) {
  db.prepare('DELETE FROM staff_sessions WHERE staff_id = ?').run(staffId);
}
const hashPin = (pin) => bcrypt.hash(String(pin), SALT_ROUNDS);
async function isPinTaken(rawPin, excludeId = null) {
  const all = db.prepare('SELECT id, pin FROM staff WHERE active = 1').all();
  for (const s of all) {
    if (excludeId !== null && s.id === excludeId) continue;
    if (await verifyPin(rawPin, s.pin)) return true;
  }
  return false;
}

// ── GET / — list staff (admin only; PINs are never returned) ──────────────
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT id, name, role, active FROM staff ORDER BY name').all());
});

// ── POST / — add staff (admin only) ───────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, pin, role } = req.body || {};
  if (!name || !pin || !role) return res.status(400).json({ error: 'name, pin, role required' });
  if (!['admin', 'waiter', 'kitchen'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const staffCount = db.prepare('SELECT COUNT(*) AS c FROM staff WHERE active = 1').get().c;
  const lim = entitlements.check(ctx.get().restaurant, 'max_staff', staffCount);
  if (!lim.ok) return res.status(403).json({ error: `Your plan allows up to ${lim.limit} staff accounts.`, code: 'plan_limit' });
  const weak = pinProblem(pin);
  if (weak) return res.status(400).json({ error: weak });
  if (await isPinTaken(pin)) {
    return res.status(409).json({ error: 'This PIN is already in use by another staff member. Please choose a different PIN.' });
  }
  const info = db.prepare('INSERT INTO staff (name, pin, role) VALUES (?, ?, ?)')
    .run(String(name).trim().slice(0, 40), await hashPin(pin), role);
  res.status(201).json(db.prepare('SELECT id, name, role, active FROM staff WHERE id = ?').get(info.lastInsertRowid));
});

// ── PUT /:id — update staff (admin only) ──────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, pin, role, active } = req.body || {};
  let hashedPin = null;
  if (pin) {
    const weak = pinProblem(pin);
    if (weak) return res.status(400).json({ error: weak });
    if (await isPinTaken(pin, parseInt(req.params.id, 10))) {
      return res.status(409).json({ error: 'This PIN is already in use by another staff member. Please choose a different PIN.' });
    }
    hashedPin = await hashPin(pin);
  }
  if (role && !['admin', 'waiter', 'kitchen'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  db.prepare(`
    UPDATE staff SET
      name   = COALESCE(?, name),
      pin    = COALESCE(?, pin),
      role   = COALESCE(?, role),
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(name || null, hashedPin, role || null, active !== undefined ? (active ? 1 : 0) : null, req.params.id);

  // A changed PIN or a deactivated account ends their current session
  if (hashedPin || active === false || active === 0) deleteSession(Number(req.params.id));
  res.json({ success: true });
});

// ── DELETE /:id ───────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const member = db.prepare('SELECT id, name, role FROM staff WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Staff member not found' });
  if (member.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) AS c FROM staff WHERE role = 'admin' AND active = 1").get().c;
    if (adminCount <= 1) return res.status(400).json({ error: 'Cannot delete the last admin account. Add another admin first.' });
  }
  deleteSession(member.id);
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── POST /verify — PIN login ──────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  const { pin, currentSessionToken } = req.body || {};
  if (!pin) return res.status(400).json({ error: 'PIN required' });

  const { device } = ctx.get();
  const key = `dev:${device.id}`;
  const wait = pinFails.check(key);
  if (wait) return res.status(429).json({ error: lockMsg(wait), code: 'locked', retry_after: wait });

  const all = db.prepare('SELECT id, name, role, pin FROM staff WHERE active = 1').all();
  for (const s of all) {
    if (!(await verifyPin(pin, s.pin))) continue;

    // A kitchen tablet should not become a waiter terminal (admins may always log in)
    if (device.role_lock && s.role !== device.role_lock && s.role !== 'admin') {
      return res.status(403).json({ error: `This device is only for ${device.role_lock} staff.` });
    }

    const existing = getSession(s.id);
    if (existing) {
      const sameDevice = currentSessionToken && existing.token === currentSessionToken;
      if (!sameDevice && currentSessionToken) {
        return res.status(409).json({
          error: `"${s.name}" is already logged in on another device. Log out there first.`,
          staffName: s.name,
        });
      }
    }

    pinFails.reset(key);
    const sessionToken = crypto.randomBytes(24).toString('hex');
    setSession(s.id, sessionToken);
    res.cookie(STAFF_COOKIE, `${s.id}.${sessionToken}`, cookieOptions(cfg.STAFF_COOKIE_DAYS));
    return res.json({ id: s.id, name: s.name, role: s.role, sessionToken });
  }

  pinFails.fail(key);
  res.status(401).json({ error: 'Invalid PIN' });
});

// ── POST /logout ──────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const { staffId, sessionToken } = req.body || {};
  if (!staffId) return res.status(400).json({ error: 'staffId required' });
  const id = Number(staffId);
  const stored = getSession(id);
  if (stored && stored.token === sessionToken) deleteSession(id);
  res.clearCookie(STAFF_COOKIE, { path: '/' });
  res.json({ success: true });
});

// ── GET /session/validate — heartbeat ─────────────────────────────────────
router.get('/session/validate', (req, res) => {
  const staffId = Number(req.query.staffId);
  const token = req.query.sessionToken;
  if (!staffId || !token) return res.json({ valid: false });
  const stored = getSession(staffId);
  const valid = !!(stored && stored.token === token);
  // Self-heal: the session is still good but this browser lost its cookie
  if (valid && (req.cookies || {})[STAFF_COOKIE] !== `${staffId}.${token}`) {
    res.cookie(STAFF_COOKIE, `${staffId}.${token}`, cookieOptions(cfg.STAFF_COOKIE_DAYS));
  }
  res.json({ valid });
});

// ── POST /check-pin — confirm an ADMIN PIN without touching sessions ──────
router.post('/check-pin', async (req, res) => {
  const { pin } = req.body || {};
  if (!pin) return res.status(400).json({ error: 'PIN required' });

  const { device } = ctx.get();
  const key = `chk:${device.id}`;
  const wait = pinFails.check(key);
  if (wait) return res.status(429).json({ error: lockMsg(wait), code: 'locked', retry_after: wait });

  const admins = db.prepare("SELECT pin FROM staff WHERE role = 'admin' AND active = 1").all();
  for (const a of admins) {
    if (await verifyPin(pin, a.pin)) { pinFails.reset(key); return res.json({ valid: true }); }
  }
  pinFails.fail(key);
  res.json({ valid: false });
});

module.exports = router;