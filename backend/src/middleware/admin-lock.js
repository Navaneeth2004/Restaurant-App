'use strict';
/**
 * Server side of the "admin lock". When the restaurant enabled the lock, sensitive routes need a recent
 * admin-PIN confirmation from THIS device: POST /staff/check-pin issues a short-lived grant (cookie + in-memory entry).
 */
const ctx = require('../db/context');
const { fail } = require('../lib/http');
const { randomToken, sha256 } = require('../lib/crypto');
const { ADMIN_COOKIE, cookieOptions } = require('../lib/cookies');
const settings = require('../repositories/catalog/settings.repo');

const grants = new Map(); // sha256(token) -> { deviceId, exp }

function lockConfig() {
  try {
    const v = JSON.parse(settings.get('admin_lock_config') || '{}');
    const t = Number(v.timeout_mins);
    return { enabled: v.enabled === true, timeoutMins: Number.isFinite(t) && t > 0 ? t : 5 };
  } catch (_) { return { enabled: false, timeoutMins: 5 }; }
}

function issue(res, deviceId) {
  const ttl = lockConfig().timeoutMins * 60000;
  const now = Date.now();
  if (grants.size > 2000) for (const [k, g] of grants) if (g.exp <= now) grants.delete(k);
  const token = randomToken(24);
  grants.set(sha256(token), { deviceId, exp: now + ttl });
  res.cookie(ADMIN_COOKIE, token, { ...cookieOptions(1), maxAge: ttl, sameSite: 'strict' });
}

function guard(req, res, next) {
  if (!lockConfig().enabled) return next();
  const { device } = ctx.get();
  const g = grants.get(sha256((req.cookies && req.cookies[ADMIN_COOKIE]) || ''));
  if (g && g.exp > Date.now() && device && g.deviceId === device.id) return next();
  return fail(403, 'Enter the admin PIN to continue.', { code: 'admin_pin_required' });
}

module.exports = { guard, issue };
