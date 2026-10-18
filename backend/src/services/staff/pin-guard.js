'use strict';
/** PIN checking + wrong-PIN lockout. Used by staff login, admin-PIN checks, "switch restaurant" and history deletion. */
const bcrypt = require('bcryptjs');
const { HttpError } = require('../../lib/http');
const { failTracker } = require('../../lib/fail-tracker');
const { isHashed } = require('../../lib/pin-rules');
const staff = require('../../repositories/staff/staff.repo');

const pinFails = failTracker({ max: 5, windowMs: 10 * 60 * 1000, lockMs: 5 * 60 * 1000 });

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

/** Throws 429 while `key` is locked. */
function assertNotLocked(key) {
  const wait = pinFails.check(key);
  if (wait) throw new HttpError(429, lockMessage(wait), { code: 'locked', retry_after: Math.ceil(wait / 1000) });
}

/** Admin PIN check with lockout. @returns the admin ({id, name}) or null when wrong. */
async function adminByPin(key, pin) {
  assertNotLocked(key);
  const admin = await findAdminByPin(pin);
  if (admin) pinFails.reset(key);
  else pinFails.fail(key);
  return admin;
}

module.exports = { pinFails, verifyPin, findAdminByPin, assertNotLocked, adminByPin, lockMessage };
