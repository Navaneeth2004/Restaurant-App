'use strict';
/** Device cookies: the "this browser is linked to a restaurant" credential. */
const crypto = require('crypto');
const central = require('./central');
const cfg = require('./config');
const { sha256, safeEqual, nowIso, guessDeviceName } = require('./util');

const DEVICE_COOKIE = 'pos_device';
const STAFF_COOKIE  = 'pos_staff';
const DAY = 86400000;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch (_) { out[k] = v; }
  });
  return out;
}

function cookieOptions(days) {
  return { httpOnly: true, secure: cfg.COOKIE_SECURE, sameSite: 'lax', path: '/', maxAge: days * DAY };
}

/** cookie value "<deviceId>.<secret>" -> device row (or null) */
function findDevice(cookieValue) {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf('.');
  if (dot < 1) return null;
  const id = cookieValue.slice(0, dot);
  const secret = cookieValue.slice(dot + 1);
  const d = central.prepare('SELECT * FROM devices WHERE id = ? AND revoked_at IS NULL').get(id);
  if (!d || !safeEqual(sha256(secret), d.secret_hash)) return null;
  return d;
}

const touched = new Map();
function touchDevice(device, req) {
  const last = touched.get(device.id) || 0;
  if (Date.now() - last < 5 * 60 * 1000) return;
  touched.set(device.id, Date.now());
  central.prepare('UPDATE devices SET last_seen_at = ?, last_ip = ?, user_agent = ? WHERE id = ?')
    .run(nowIso(), req.ip || null, String(req.headers['user-agent'] || '').slice(0, 200), device.id);
}

/** Creates a device row and sets the cookie on the response. */
function linkDevice(req, res, { restaurantId, name, roleLock = null, via }) {
  // The browser may already be linked to something: retire that link.
  const prev = findDevice(parseCookies(req.headers.cookie)[DEVICE_COOKIE]);
  if (prev) central.prepare('UPDATE devices SET revoked_at = ? WHERE id = ?').run(nowIso(), prev.id);

  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString('base64url');
  const ua = String(req.headers['user-agent'] || '').slice(0, 200);
  const deviceName = String(name || '').trim().slice(0, 40) || guessDeviceName(ua);
  const secretHash = sha256(secret);

  central.prepare(`INSERT INTO devices
      (id, restaurant_id, name, secret_hash, token_hash, role_lock, created_via, created_at, last_seen_at, last_ip, user_agent)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, restaurantId, deviceName, secretHash, secretHash, roleLock, via, nowIso(), nowIso(), req.ip || null, ua);

  res.cookie(DEVICE_COOKIE, `${id}.${secret}`, cookieOptions(cfg.DEVICE_COOKIE_DAYS));
  res.clearCookie(STAFF_COOKIE, { path: '/' });
  return { id, name: deviceName };
}

function revokeDevice(id, restaurantId) {
  return central.prepare('UPDATE devices SET revoked_at = ? WHERE id = ? AND restaurant_id = ? AND revoked_at IS NULL')
    .run(nowIso(), id, restaurantId).changes > 0;
}

const entitlements = require('./entitlements');

/** { row, state } for a restaurant, or null if it does not exist. */
function accessInfo(id) {
  const row = central.prepare(`SELECT id, owner_id, name, status, plan, trial_ends_at, limits_json, meta_json,
                                      suspended_reason FROM restaurants WHERE id = ?`).get(id);
  return row ? { row, state: entitlements.accessState(row) } : null;
}

/** The restaurant row if it may currently be used, otherwise null. */
function activeRestaurant(id) {
  const info = accessInfo(id);
  return info && info.state.allowed ? info.row : null;
}

module.exports = {
  DEVICE_COOKIE, STAFF_COOKIE, parseCookies, cookieOptions,
  findDevice, touchDevice, linkDevice, revokeDevice, activeRestaurant, accessInfo,
};