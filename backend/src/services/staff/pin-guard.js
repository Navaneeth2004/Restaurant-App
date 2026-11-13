'use strict';
/**
 * PIN checking + wrong-PIN lockout. One shared budget per device (login, admin-PIN checks, "switch restaurant" and
 * history deletion all use key `dev:<deviceId>`) plus a restaurant-wide budget, both with escalating lock times.
 */
const bcrypt = require('bcryptjs');
const ctx = require('../../db/context');
const { HttpError } = require('../../lib/http');
const { failTracker } = require('../../lib/fail-tracker');
const { isHashed } = require('../../lib/pin-rules');
const staff = require('../../repositories/staff/staff.repo');

const SIX_HOURS = 6 * 3600 * 1000;
const pinFails = failTracker({ max: 5, windowMs: 10 * 60 * 1000, lockMs: 5 * 60 * 1000, maxLockMs: SIX_HOURS, escalate: true });
const restaurantFails = failTracker({ max: 30, windowMs: 10 * 60 * 1000, lockMs: 15 * 60 * 1000, maxLockMs: SIX_HOURS, escalate: true });
const restaurantKey = () => `rst:${ctx.restaurantId()}`;

async function verifyPin(raw, stored) {
  if (!isHashed(stored)) return false;
  return bcrypt.compare(String(raw), stored);
}

/** The active admin whose PIN this is, or null. */
async function findAdminByPin(pin) {
  for (const admin of staff.activeAdminsWithPin()) if (await verifyPin(pin, admin.pin)) return admin;
  return null;
}

const lockMessage = (ms) => `Too many wrong PINs. Try again in ${Math.max(1, Math.ceil(ms / 60000))} minute(s).`;

/** Throws 429 while the device or the whole restaurant is locked. */
function assertNotLocked(key) {
  const wait = Math.max(pinFails.check(key), restaurantFails.check(restaurantKey()));
  if (wait) throw new HttpError(429, lockMessage(wait), { code: 'locked', retry_after: Math.ceil(wait / 1000) });
}

function recordFail(key) { pinFails.fail(key); restaurantFails.fail(restaurantKey()); }
function recordSuccess(key) { pinFails.reset(key); }

/** Admin PIN check with lockout. @returns the admin ({id, name}) or null when wrong. */
async function adminByPin(key, pin) {
  assertNotLocked(key);
  const admin = await findAdminByPin(pin);
  if (admin) recordSuccess(key);
  else recordFail(key);
  return admin;
}

module.exports = { pinFails, verifyPin, findAdminByPin, assertNotLocked, adminByPin, lockMessage, recordFail, recordSuccess };
