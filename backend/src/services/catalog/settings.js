'use strict';
const { fail } = require('../../lib/http');
const { SECRET_SETTING_KEYS } = require('../../config/defaults');
const settings = require('../../repositories/catalog/settings.repo');
const files = require('../files/paths');

const KEY_RE = /^[a-z0-9_]{1,60}$/;
const MAX_KEYS = 100;

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
