'use strict';
/** What a browser shows first, joining with a pairing code, and "switch restaurant". */
const express = require('express');
const access = require('../../middleware/access');
const ctx = require('../../db/context');
const { handle, fail } = require('../../lib/http');
const { ipKey } = require('../../lib/ip');
const { DEVICE_COOKIE } = require('../../lib/cookies');
const { deviceStatus } = require('../../services/devices/status');
const { redeemCode } = require('../../services/devices/pairing');
const deviceService = require('../../services/devices/devices');
const pinGuard = require('../../services/staff/pin-guard');
const sessions = require('../../services/staff/sessions');
const { linkAndSetCookie, clearLinkCookies, ipLimit } = require('./helpers');

const router = express.Router();

router.get('/device/status', access.public, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(deviceStatus(req.cookies[DEVICE_COOKIE]));
});

router.post('/device/pair', access.public, ipLimit, handle((req, res) => {
  const body = req.body || {};
  const { restaurant, roleLock } = redeemCode(body.code, ipKey(req.ip));
  linkAndSetCookie(req, res, { restaurantId: restaurant.id, name: body.device_name, roleLock, via: 'pairing' });
  res.locals.audit = { restaurant };
  res.json({ linked: true, restaurant });
}));

// "Switch restaurant" from the PIN screen: needs an ADMIN PIN. A staff session still open on this device ends with it.
router.post('/device/unlink', access.device, handle(async (req, res) => {
  const { restaurantId, device, staff } = ctx.get();
  const admin = await pinGuard.adminByPin(`dev:${device.id}`, (req.body || {}).pin);
  if (!admin) fail(401, 'Incorrect admin PIN.');
  deviceService.revoke(device.id, restaurantId);
  if (staff) sessions.end(staff.id);
  clearLinkCookies(res);
  res.json({ success: true });
}));

module.exports = router;
