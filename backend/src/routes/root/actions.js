'use strict';
/** Root console: suspend / activate / revoke devices / reset owner password / delete a restaurant. */
const express = require('express');
const access = require('../../middleware/access');
const { handle, fail } = require('../../lib/http');
const lifecycle = require('../../services/restaurants/lifecycle');
const rootAuth = require('../../services/root/auth');
const audit = require('../../services/root/audit');
const { actorOf, restaurantOr404 } = require('./helpers');

const router = express.Router();

router.post('/restaurants/:id/suspend', access.root, handle((req, res) => {
  const r = restaurantOr404(req);
  const reason = (req.body || {}).reason;
  lifecycle.suspend(r.id, reason);
  audit.record(actorOf(req), 'restaurant.suspend', r.id, { reason: String(reason || '').slice(0, 200) || null });
  res.json({ success: true });
}));

router.post('/restaurants/:id/activate', access.root, handle((req, res) => {
  const r = restaurantOr404(req);
  lifecycle.activate(r.id);
  audit.record(actorOf(req), 'restaurant.activate', r.id);
  res.json({ success: true });
}));

router.post('/restaurants/:id/revoke-devices', access.root, handle((req, res) => {
  const r = restaurantOr404(req);
  const revoked = lifecycle.revokeDevices(r.id);
  audit.record(actorOf(req), 'restaurant.revoke_devices', r.id, { count: revoked });
  res.json({ success: true, revoked });
}));

router.post('/restaurants/:id/owner-password', access.root, handle(async (req, res) => {
  const r = restaurantOr404(req);
  const provided = (req.body || {}).password;
  const generated = await lifecycle.setOwnerPassword(r.owner_id, provided);
  audit.record(actorOf(req), 'owner.password_reset', r.owner_id, { restaurant: r.id });
  res.json({ success: true, temp_password: generated });
}));

router.delete('/restaurants/:id', access.root, handle(async (req, res) => {
  const r = restaurantOr404(req);
  const body = req.body || {};
  if (String(body.confirm_name || '') !== r.name) fail(400, 'Type the restaurant name exactly to confirm.');
  if (!(await rootAuth.confirmPassword(req.root.owner.id, body.password))) fail(403, 'Your root password is incorrect.');
  lifecycle.deleteRestaurant(r.id);
  audit.record(actorOf(req), 'restaurant.delete', r.id, { name: r.name });
  res.json({ success: true });
}));

module.exports = router;
