'use strict';
const { fail } = require('../../lib/http');
const { isGstin } = require('../../lib/gstin');
const { SECRET_SETTING_KEYS } = require('../../config/defaults');
const { STATE_CODES } = require('../../config/gst');
const settings = require('../../repositories/catalog/settings.repo');
const files = require('../files/paths');

const KEY_RE = /^[a-z0-9_]{1,60}$/;
const MAX_KEYS = 100;
const LOGO_RE = /^\/uploads\/[a-f0-9-]{10,36}\/[A-Za-z0-9._-]+$/;

/** Every non-secret setting. */
function listForClient() {
  return Object.fromEntries(Object.entries(settings.all()).filter(([k]) => !SECRET_SETTING_KEYS.has(k)));
}

/** @returns the accepted subset (what other devices get broadcast) */
function update(body) {
  const entries = Object.entries(body || {});
  if (entries.length > MAX_KEYS) fail(400, 'Too many settings at once.');
  const accepted = {};
  for (const [key, value] of entries) {
    if (SECRET_SETTING_KEYS.has(key) || !KEY_RE.test(key)) continue;
    accepted[key] = String(value).slice(0, 5000);
  }
  if ('tax_percent' in accepted) {
    const n = parseFloat(accepted.tax_percent);
    if (!Number.isFinite(n) || n < 0 || n > 100) fail(400, 'Tax percent must be between 0 and 100.');
  }
  if ('gstin' in accepted) {
    accepted.gstin = accepted.gstin.trim().toUpperCase();
    if (accepted.gstin && !isGstin(accepted.gstin)) fail(400, 'That GSTIN is not valid (15 characters, e.g. 32ABCDE1234F1Z5).');
  }
  if ('state_name' in accepted && !STATE_CODES[accepted.state_name]) fail(400, 'Choose a valid state.');
  if ('logo_url' in accepted && accepted.logo_url && !LOGO_RE.test(accepted.logo_url)) fail(400, 'Invalid logo.');
  if ('tz_offset_min' in accepted) {
    const n = Number(accepted.tz_offset_min);
    if (!Number.isInteger(n) || Math.abs(n) > 840) fail(400, 'Invalid time zone offset.');
  }
  settings.setMany(accepted);
  return accepted;
}

/** @param file multer file */
function setLogo(rid, file) {
  if (!file) fail(400, 'No file uploaded');
  const url = files.publicUrl(rid, file.filename);
  const old = settings.get('logo_url');
  if (old) files.removeUpload(rid, old);
  settings.set('logo_url', url);
  return url;
}

module.exports = { listForClient, update, setLogo };
