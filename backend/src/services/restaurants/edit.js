'use strict';
/** Validates the root console's "edit restaurant" form and writes it. */
const { fail } = require('../../lib/http');
const { PLANS } = require('../../config/plans');
const restaurants = require('../../repositories/central/restaurants.repo');
const limits = require('./limits');

const MAX_META = 8000;

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
    if (!PLANS[body.plan]) fail(400, 'Unknown plan.');
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
  return changed;
}

module.exports = { applyPatch };
