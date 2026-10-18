'use strict';
/** Barrier 1: the browser must carry a "pos_device" cookie issued after owner login or pairing. */
const ctx = require('../../db/context');
const { DEVICE_COOKIE } = require('../../lib/cookies');
const { clientMeta } = require('../../lib/http');
const devices = require('../../services/devices/devices');
const access = require('../../services/restaurants/access');
const attachStaff = require('./staff-context');

function suspendedMessage(reason) {
  if (reason === 'trial_expired') return 'The free trial has ended. Please contact support.';
  if (reason && reason !== 'suspended') return `This account is suspended: ${reason}`;
  return 'This restaurant account is not active. Please contact support.';
}

module.exports = (req, res, next) => {
  const device = devices.find(req.cookies[DEVICE_COOKIE]);
  if (!device) return res.status(401).json({ error: 'This device is not linked to a restaurant.', code: 'device_required' });

  const info = access.accessInfo(device.restaurant_id);
  if (!info || !info.state.allowed) {
    const reason = info && info.state.reason;
    return res.status(403).json({ error: suspendedMessage(reason), code: 'restaurant_suspended', reason: reason || 'suspended' });
  }
  devices.touch(device, clientMeta(req));

  const store = { restaurantId: info.row.id, restaurant: info.row, device, staff: null };
  req.restaurantId = info.row.id;       // plain copy for code that runs outside the async context (e.g. multer)
  req._ctx = store;
  return ctx.run(store, () => { attachStaff(store, req.cookies); next(); });
};
