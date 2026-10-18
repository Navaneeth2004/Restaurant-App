'use strict';
/** Device credentials: a browser carries "pos_device=<id>.<secret>" once it is linked to a restaurant. */
const { DEVICE_COOKIE, STAFF_COOKIE } = require('../../lib/cookies');
const { sha256, safeEqual } = require('../../lib/crypto');
const devices = require('../../repositories/central/devices.repo');
const bus = require('../../realtime/bus');

const TOUCH_EVERY_MS = 5 * 60 * 1000;
const lastTouched = new Map();

/** cookie value "<deviceId>.<secret>" -> device row, or null */
function find(cookieValue) {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf('.');
  if (dot < 1) return null;
  const device = devices.activeById(cookieValue.slice(0, dot));
  return device && safeEqual(sha256(cookieValue.slice(dot + 1)), device.secret_hash) ? device : null;
}

/** Records "last seen" at most every few minutes per device. */
function touch(device, meta) {
  const now = Date.now();
  if (now - (lastTouched.get(device.id) || 0) < TOUCH_EVERY_MS) return;
  if (lastTouched.size > 5000) {
    for (const [id, t] of lastTouched) if (now - t > TOUCH_EVERY_MS) lastTouched.delete(id);
  }
  lastTouched.set(device.id, now);
  devices.touch(device.id, new Date(now).toISOString(), meta.ip, meta.userAgent);
}

/** Removes a device and cuts its live connection. */
function revoke(deviceId, restaurantId) {
  const ok = devices.revoke(deviceId, restaurantId, new Date().toISOString());
  if (ok) bus.disconnectDevice(deviceId);
  return ok;
}

/** Revokes every device of a restaurant (everyone must link again). */
function revokeAll(restaurantId) {
  const n = devices.revokeAllFor(restaurantId, new Date().toISOString());
  bus.kickRestaurant(restaurantId);
  return n;
}

const listFor = (restaurantId, currentId) =>
  devices.listActive(restaurantId).map((d) => ({ ...d, is_current: d.id === currentId }));

module.exports = { DEVICE_COOKIE, STAFF_COOKIE, find, touch, revoke, revokeAll, listFor };
