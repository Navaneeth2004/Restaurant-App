'use strict';

const path = require('path');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const cookieSecure = process.env.COOKIE_SECURE === undefined
  ? process.env.NODE_ENV === 'production'
  : process.env.COOKIE_SECURE === 'true';

module.exports = Object.freeze({
  DATA_DIR,
  DEPLOYMENT: process.env.DEPLOYMENT || 'cloud',
  COOKIE_SECURE: cookieSecure,
  TRUST_PROXY: process.env.TRUST_PROXY === '1' ? 1 : process.env.TRUST_PROXY,
  DEVICE_COOKIE_DAYS: Number(process.env.DEVICE_COOKIE_DAYS || 365),
  STAFF_COOKIE_DAYS: Number(process.env.STAFF_COOKIE_DAYS || 30),
  ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION !== 'false',
  PUBLIC_URL: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
});
