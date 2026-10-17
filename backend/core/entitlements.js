'use strict';
/**
 * Plans, limits and "may this restaurant use the system right now?" in ONE place.
 * Billing / trial limits plug in here later without touching the routes.
 *
 * To add a limit:   1. add a key to LIMIT_KEYS (the root console builds its form from this list)
 *                   2. call check(restaurant, 'your_key', currentCount) where it matters
 * To add a plan:    add it to PLANS. {} means "no limits". Per-restaurant overrides (set in the root
 *                   console, stored in restaurants.limits_json) always win over the plan defaults.
 */
const cfg = require('./config');

const LIMIT_KEYS = {
  max_devices: { label: 'Max linked devices' },
  max_staff:   { label: 'Max staff accounts' },
  max_tables:  { label: 'Max tables' },
};

const PLANS = {
  trial:    {},
  standard: {},          // e.g. later: { max_devices: 5, max_staff: 15 }
  premium:  {},
};

function parse(json) { try { return json ? JSON.parse(json) : {}; } catch (_) { return {}; } }

/** Effective limits (plan defaults + overrides). null/undefined = unlimited. */
function limitsFor(r) { return { ...(PLANS[r.plan] || {}), ...parse(r.limits_json) }; }

/** { ok, limit } — ok is false once `current` has reached the limit. */
function check(r, key, current) {
  const lim = limitsFor(r)[key];
  if (lim === undefined || lim === null || lim === '') return { ok: true, limit: null };
  return { ok: current < Number(lim), limit: Number(lim) };
}

/** Can this restaurant's devices use the system right now? */
function accessState(r) {
  if (r.status !== 'active') return { allowed: false, reason: r.suspended_reason || 'suspended' };
  if (cfg.ENFORCE_TRIAL && r.plan === 'trial' && r.trial_ends_at && new Date(r.trial_ends_at) < new Date()) {
    return { allowed: false, reason: 'trial_expired' };
  }
  return { allowed: true };
}

module.exports = { LIMIT_KEYS, PLANS, limitsFor, check, accessState, parse };