'use strict';
/** All environment-driven settings. The ONLY place that reads process.env. */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const bool = (v, d) => (v === undefined || v === '' ? d : String(v).toLowerCase() === 'true');
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', 'data');
const tp = process.env.TRUST_PROXY;

module.exports = {
  IS_PROD,
  PORT: process.env.PORT || 4000,
  DEPLOYMENT: process.env.DEPLOYMENT || 'cloud',

  DATA_DIR,
  CENTRAL_DB: path.join(DATA_DIR, 'accounts.db'),
  TENANT_DIR: path.join(DATA_DIR, 'tenants'),
  FILES_DIR: path.join(DATA_DIR, 'files'),
  TICKETS_DIR: path.join(DATA_DIR, 'tickets'),

  COOKIE_SECURE: bool(process.env.COOKIE_SECURE, IS_PROD),
  TRUST_PROXY: tp ? (Number.isNaN(Number(tp)) ? tp : Number(tp)) : 0,
  PUBLIC_URL: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),

  ALLOW_REGISTRATION: bool(process.env.ALLOW_REGISTRATION, true),
  AUTH_METHODS: (process.env.AUTH_METHODS || 'password').split(',').map(s => s.trim()).filter(Boolean),
  DEFAULT_COUNTRY_CODE: process.env.DEFAULT_COUNTRY_CODE || '91',
  MAX_OPEN_TENANTS: parseInt(process.env.MAX_OPEN_TENANTS || '100', 10),
  ENFORCE_TRIAL: bool(process.env.ENFORCE_TRIAL, false),

  ROOT_SESSION_HOURS: 8,
  ROOT_IDLE_HOURS: 2,
  DEVICE_COOKIE_DAYS: 365,
  STAFF_COOKIE_DAYS: 7,
  STAFF_SESSION_DAYS: 7,       // enforced on the server, not just by the cookie
  STAFF_ACTIVE_HOURS: 12,      // a session idle longer than this no longer blocks a login elsewhere
  PAIRING_CODE_MINUTES: 10,
};
