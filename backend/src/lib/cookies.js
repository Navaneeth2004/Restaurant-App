'use strict';
const cfg = require('../config/env');

const DAY = 86400000;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch (_) { out[k] = v; }
  });
  return out;
}

const cookieOptions = (days) => ({
  httpOnly: true, secure: cfg.COOKIE_SECURE, sameSite: 'lax', path: '/', maxAge: days * DAY,
});

const DEVICE_COOKIE = 'pos_device';
const STAFF_COOKIE = 'pos_staff';
const ROOT_COOKIE = 'pos_root';

module.exports = { parseCookies, cookieOptions, DEVICE_COOKIE, STAFF_COOKIE, ROOT_COOKIE };
