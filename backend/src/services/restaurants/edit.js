'use strict';
/** Validates the root console's "edit restaurant" form and writes it. */
const { fail } = require('../../lib/http');
const { KEYS } = require('../../config/features');
const restaurants = require('../../repositories/central/restaurants.repo');
const features = require('../../repositories/central/features.repo');
const { notify } = require('../features/notify');
const limits = require('./limits');

const MAX_META = 8000;

/** { "<feature>": true | false | null } from the form; null means "inherit" and is not stored. */
function overridesFrom(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) fail(400, 'features must be an object.');
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (!KEYS.has(key)) fail(400, `Unknown feature: ${key}`);
    if (value === true || value === false) out[key] = value;
    else if (value !== null) fail(400, 'Each feature must be on, off or inherit.');
  }
  return out;
}

/** @returns { fields: {column: value}, changed: {label: value} } */
function buildPatch(body = {}) {
  const fields = {}, changed = {};
  const set = (col, val, label) => { fields[col] = val; changed[label || col] = val; };

  if (body.name !== undefined) {
    const n = String(body.name).trim().slice(0, 60);
    if (!n) fail(400, 'Name cannot be empty.');
    set('name', n);
  }
  if (body.plan !== undefined) {
    if (!features.subscriptionBySlug(body.plan)) fail(400, 'Unknown plan.');
    set('plan', body.plan);
  }
  if (body.trial_ends_at !== undefined) {
    if (body.trial_ends_at === null || body.trial_ends_at === '') set('trial_ends_at', null);
    else {
      const d = new Date(body.trial_ends_at);
      if (Number.isNaN(d.getTime())) fail(400, 'Invalid trial end date.');
      set('trial_ends_at', d.toISOString());
    }
  }
  if (body.notes !== undefined) set('notes', String(body.notes).slice(0, 4000));
  if (body.limits !== undefined) {
    try { set('limits_json', JSON.stringify(limits.validateLimits(body.limits)), 'limits'); }
    catch (e) { fail(400, e.message); }
  }
  if (body.features !== undefined) set('feature_overrides_json', JSON.stringify(overridesFrom(body.features)), 'features');
  if (body.meta !== undefined) {
    if (typeof body.meta !== 'object' || body.meta === null || Array.isArray(body.meta)) fail(400, 'meta must be an object.');
    const s = JSON.stringify(body.meta);
    if (s.length > MAX_META) fail(400, 'meta is too large.');
    set('meta_json', s, 'meta');
  }
  if (!Object.keys(fields).length) fail(400, 'Nothing to update.');
  return { fields, changed };
}

function applyPatch(id, body) {
  const { fields, changed } = buildPatch(body);
  restaurants.update(id, fields, new Date().toISOString());
  if ('plan' in changed || 'features' in changed) notify([id]);
  return changed;
}

module.exports = { applyPatch };
