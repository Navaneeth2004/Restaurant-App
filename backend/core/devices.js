'use strict';

const crypto = require('crypto');
const central = require('./central');
const cfg = require('./config');

const DEVICE_COOKIE = 'pos_device';
const STAFF_COOKIE = 'pos_staff';

function parseCookies(header = '') {
  const result = {};
  for (const pair of String(header).split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    const key = pair.slice(0, index).trim();
    try { result[key] = decodeURIComponent(pair.slice(index + 1).trim()); }
    catch { result[key] = ''; }
  }
  return result;
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function createDevice(restaurantId, { name, roleLock = null, createdVia = 'owner' }) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const id = crypto.randomUUID();
  central.prepare(`
    INSERT INTO devices (id, token_hash, restaurant_id, name, role_lock, created_via, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, digest(raw), restaurantId, String(name || 'Device').trim().slice(0, 40), roleLock, createdVia, new Date().toISOString());
  return { id, raw };
}

function findDevice(raw) {
  if (!raw) return null;
  return central.prepare(`
    SELECT d.id, d.restaurant_id, d.name, d.role_lock, d.created_via, d.created_at,
           d.last_seen_at, d.last_ip, r.name AS restaurant_name, r.active AS restaurant_active
    FROM devices d JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.token_hash = ?
  `).get(digest(raw)) || null;
}

function activeRestaurant(id) {
  return central.prepare('SELECT id, name, active FROM restaurants WHERE id = ?').get(id) || null;
}

function setDeviceCookie(res, raw) {
  res.cookie(DEVICE_COOKIE, raw, cookieOptions(cfg.DEVICE_COOKIE_DAYS));
}

function clearDeviceCookie(res) {
  res.clearCookie(DEVICE_COOKIE, { ...cookieOptions(0), expires: new Date(0) });
}

function cookieOptions(days) {
  return {
    httpOnly: true,
    secure: cfg.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: days > 0 ? days * 24 * 60 * 60 * 1000 : undefined,
  };
}

function staffCookieValue(req) {
  return parseCookies(req.headers.cookie)[STAFF_COOKIE] || '';
}

module.exports = {
  DEVICE_COOKIE, STAFF_COOKIE, parseCookies, digest, createDevice, findDevice,
  activeRestaurant, setDeviceCookie, clearDeviceCookie, cookieOptions, staffCookieValue,
};
