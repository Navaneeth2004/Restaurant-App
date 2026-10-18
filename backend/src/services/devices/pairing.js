'use strict';
/** One-time 6-digit codes an admin creates so a staff phone can join the restaurant. */
const cfg = require('../../config/env');
const { fail } = require('../../lib/http');
const { sha256, randomDigits } = require('../../lib/crypto');
const { failTracker } = require('../../lib/fail-tracker');
const codes = require('../../repositories/central/pairing-codes.repo');
const restaurants = require('../../repositories/central/restaurants.repo');
const limits = require('../restaurants/limits');
const access = require('../restaurants/access');

const MAX_UNUSED = 10;
const pairFails = failTracker({ max: 8, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 });
const lockedMsg = (ms) => `Too many wrong attempts. Try again in ${Math.max(1, Math.ceil(ms / 60000))} minute(s).`;

function createCode(restaurantId, roleLockInput, fallbackOrigin) {
  const roleLock = ['waiter', 'kitchen'].includes(roleLockInput) ? roleLockInput : null;
  const now = new Date().toISOString();
  codes.purge(now);
  if (codes.countFor(restaurantId) >= MAX_UNUSED) fail(429, 'Too many unused codes. Wait for them to expire.');

  const expiresAt = new Date(Date.now() + cfg.PAIRING_CODE_MINUTES * 60000).toISOString();
  for (let i = 0; i < 10; i++) {
    const code = randomDigits(6);
    try {
      codes.insert({ hash: sha256(code), restaurantId, roleLock, now, expiresAt });
      return { code, expires_at: expiresAt, role_lock: roleLock, pair_url: `${cfg.PUBLIC_URL || fallbackOrigin}/pair?code=${code}` };
    } catch (_) { /* code collision: try another */ }
  }
  return fail(500, 'Could not create a code. Try again.');
}

/** Uses a code. @returns { restaurant: {id, name}, roleLock } */
function redeemCode(rawCode, ip) {
  const failKey = `pair|${ip}`;
  const wait = pairFails.check(failKey);
  if (wait) fail(429, lockedMsg(wait), { code: 'locked', retry_after: Math.ceil(wait / 1000) });

  const code = String(rawCode || '').replace(/\D/g, '');
  if (code.length !== 6) fail(400, 'Enter the 6-digit code.');

  const now = new Date().toISOString();
  const peek = codes.peek(sha256(code), now);
  if (peek && limits.deviceLimitReached(peek.restaurant_id)) fail(403, limits.LIMIT_MSG, { code: 'plan_limit' });

  const row = codes.redeem(sha256(code), now);
  const active = row && access.activeRestaurant(row.restaurant_id);
  if (!active) {
    pairFails.fail(failKey);
    fail(400, 'That code is invalid or has expired. Ask your manager for a new one.');
  }
  pairFails.reset(failKey);
  const restaurant = restaurants.byId(active.id);
  return { restaurant: { id: restaurant.id, name: restaurant.name }, roleLock: row.role_lock };
}

module.exports = { createCode, redeemCode };
