'use strict';
/** Admin screens: pairing codes and the list of linked devices. */
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const ctx = require('../../db/context');
const { handle, fail } = require('../../lib/http');
const { createCode } = require('../../services/devices/pairing');
const deviceService = require('../../services/devices/devices');
const sessions = require('../../services/staff/sessions');

const router = express.Router();
const on = feature.of('admin.devices');

router.post('/pairing-code', access.admin, on, handle((req, res) => {
  const { restaurantId } = ctx.get();
  const origin = `${req.protocol}://${req.get('host')}`;
  res.json(createCode(restaurantId, (req.body || {}).role_lock, origin));
}));

router.get('/devices', access.admin, on, (req, res) => {
  const { restaurantId, device } = ctx.get();
  res.json(deviceService.listFor(restaurantId, device.id));
});

// Removing THIS device also ends the PIN session open on it, so the person can sign in again on a new link.
router.delete('/devices/:id', access.admin, on, handle((req, res) => {
  const { restaurantId, device, staff } = ctx.get();
  if (!deviceService.revoke(req.params.id, restaurantId)) fail(404, 'Device not found.');
  if (req.params.id === device.id && staff) sessions.end(staff.id);
  res.json({ success: true });
}));

module.exports = router;