'use strict';
/** Admin screens: pairing codes and the list of linked devices. */
const express = require('express');
const access = require('../../middleware/access');
const ctx = require('../../db/context');
const { handle, fail } = require('../../lib/http');
const { createCode } = require('../../services/devices/pairing');
const deviceService = require('../../services/devices/devices');

const router = express.Router();

router.post('/pairing-code', access.admin, handle((req, res) => {
  const { restaurantId } = ctx.get();
  const origin = `${req.protocol}://${req.get('host')}`;
  res.json(createCode(restaurantId, (req.body || {}).role_lock, origin));
}));

router.get('/devices', access.admin, (req, res) => {
  const { restaurantId, device } = ctx.get();
  res.json(deviceService.listFor(restaurantId, device.id));
});

router.delete('/devices/:id', access.admin, handle((req, res) => {
  if (!deviceService.revoke(req.params.id, ctx.get().restaurantId)) fail(404, 'Device not found.');
  res.json({ success: true });
}));

module.exports = router;
