'use strict';
/** Plan limits and "may this restaurant use the system right now?" in ONE place. */
const cfg = require('../../config/env');
const { PLANS, LIMIT_KEYS } = require('../../config/plans');
const restaurants = require('../../repositories/central/restaurants.repo');
const devices = require('../../repositories/central/devices.repo');

const LIMIT_MSG = 'This restaurant has reached the number of devices its plan allows. Remove an old device first (Admin → Devices) or contact support.';

function parse(json) { try { return json ? JSON.parse(json) : {}; } catch (_) { return {}; } }

/** Effective limits (plan defaults + per-restaurant overrides). null/undefined = unlimited. */
const limitsFor = (r) => ({ ...(PLANS[r.plan] || {}), ...parse(r.limits_json) });

/** { ok, limit } — ok is false once `current` has reached the limit. */
function check(r, key, current) {
  const lim = limitsFor(r)[key];
  if (lim === undefined || lim === null || lim === '') return { ok: true, limit: null };
  return { ok: current < Number(lim), limit: Number(lim) };
}

function accessState(r) {
  if (r.status !== 'active') return { allowed: false, reason: r.suspended_reason || 'suspended' };
  if (cfg.ENFORCE_TRIAL && r.plan === 'trial' && r.trial_ends_at && new Date(r.trial_ends_at) < new Date()) {
    return { allowed: false, reason: 'trial_expired' };
  }
  return { allowed: true };
}

/** true when the restaurant's plan does not allow another linked device */
function deviceLimitReached(restaurantId) {
  const r = restaurants.planRow(restaurantId);
  return !!r && !check(r, 'max_devices', devices.countActive(restaurantId)).ok;
}

/** Validates the override object from the root console; throws a plain Error with a readable message. */
function validateLimits(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    if (!LIMIT_KEYS[k]) throw new Error(`Unknown limit: ${k}`);
    const v = obj[k];
    if (v === null || v === '' || v === undefined) continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) throw new Error(`${LIMIT_KEYS[k].label} must be a whole number`);
    out[k] = n;
  }
  return out;
}

module.exports = { LIMIT_MSG, parse, limitsFor, check, accessState, deviceLimitReached, validateLimits };
