'use strict';
/** Shared PIN checking + wrong-PIN lockout (used by staff login, admin-PIN checks and "switch restaurant"). */
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { failTracker } = require('../middleware/rateLimit');

const pinFails = failTracker({ max: 5, windowMs: 10 * 60 * 1000, lockMs: 5 * 60 * 1000 });

async function verifyPin(raw, stored) {
  if (!stored || !(stored.startsWith('$2a$') || stored.startsWith('$2b$'))) return false;
  return bcrypt.compare(String(raw), stored);
}

async function isAdminPin(pin) {
  const admins = db.prepare("SELECT pin FROM staff WHERE role = 'admin' AND active = 1").all();
  for (const a of admins) if (await verifyPin(pin, a.pin)) return true;
  return false;
}

const lockMsg = (sec) => `Too many wrong PINs. Try again in ${Math.max(1, Math.ceil(sec / 60))} minute(s).`;

module.exports = { pinFails, verifyPin, isAdminPin, lockMsg };