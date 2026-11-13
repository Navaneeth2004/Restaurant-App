'use strict';
/** PIN login, logout, heartbeat and admin-PIN confirmation (barrier 2). Needs a linked device, not a PIN session. */
const express = require('express');
const access = require('../../middleware/access');
const adminLock = require('../../middleware/admin-lock');
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
  res.locals.audit = { staff: { name: out.name, role: out.role } };
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

// heartbeat. POST with a body: the session token must never sit in a URL (proxy and access logs). It does not count as activity.
router.post('/session/validate', access.device, (req, res) => {
  const staffId = Number((req.body || {}).staffId);
  const token = (req.body || {}).sessionToken;
  if (!staffId || !token) return res.json({ valid: false });
  return res.json({ valid: sessions.validate(staffId, String(token), false) });
});

// confirm an ADMIN PIN. When correct, this device also gets a short-lived grant for the routes behind the admin lock.
router.post('/check-pin', access.device, handle(async (req, res) => {
  const { pin } = req.body || {};
  if (!pin) fail(400, 'PIN required');
  const device = ctx.get().device;
  const admin = await pinGuard.adminByPin(`dev:${device.id}`, pin);
  if (admin) adminLock.issue(res, device.id);
  res.json({ valid: !!admin });
}));

module.exports = router;
