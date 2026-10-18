'use strict';
/** PIN login, logout, heartbeat and admin-PIN confirmation (barrier 2). Needs a linked device, not a PIN session. */
const express = require('express');
const access = require('../../middleware/access');
const ctx = require('../../db/context');
const cfg = require('../../config/env');
const { handle, fail } = require('../../lib/http');
const { STAFF_COOKIE, cookieOptions } = require('../../lib/cookies');
const { pinLogin } = require('../../services/staff/login');
const sessions = require('../../services/staff/sessions');
const pinGuard = require('../../services/staff/pin-guard');
const bus = require('../../realtime/bus');

const router = express.Router();

router.post('/verify', access.device, handle(async (req, res) => {
  const body = req.body || {};
  const out = await pinLogin({
    pin: body.pin, currentSessionToken: body.currentSessionToken,
    cookieValue: req.cookies[STAFF_COOKIE], device: ctx.get().device,
  });
  res.cookie(STAFF_COOKIE, out.cookieValue, cookieOptions(cfg.STAFF_COOKIE_DAYS));
  res.json({ id: out.id, name: out.name, role: out.role, sessionToken: out.sessionToken });
}));

router.post('/logout', access.device, handle((req, res) => {
  const { staffId, sessionToken } = req.body || {};
  if (!staffId) fail(400, 'staffId required');
  const { restaurantId, device } = ctx.get();
  sessions.endIfToken(Number(staffId), sessionToken);
  bus.demoteDevice(restaurantId, device.id);
  res.clearCookie(STAFF_COOKIE, { path: '/' });
  res.json({ success: true });
}));

// heartbeat
router.get('/session/validate', access.device, (req, res) => {
  const staffId = Number(req.query.staffId);
  const token = req.query.sessionToken;
  if (!staffId || !token) return res.json({ valid: false });
  const valid = sessions.validate(staffId, token);
  const cookie = sessions.cookieValueOf(staffId, token);
  // Self-heal: the session is still good but this browser lost its cookie
  if (valid && req.cookies[STAFF_COOKIE] !== cookie) res.cookie(STAFF_COOKIE, cookie, cookieOptions(cfg.STAFF_COOKIE_DAYS));
  return res.json({ valid });
});

// confirm an ADMIN PIN without touching sessions
router.post('/check-pin', access.device, handle(async (req, res) => {
  const { pin } = req.body || {};
  if (!pin) fail(400, 'PIN required');
  const admin = await pinGuard.adminByPin(`chk:${ctx.get().device.id}`, pin);
  res.json({ valid: !!admin });
}));

module.exports = router;
