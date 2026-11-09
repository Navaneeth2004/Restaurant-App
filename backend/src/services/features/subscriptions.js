'use strict';
/** Subscriptions: a named bundle of limits and switched-off features that restaurants are placed on (root console). */
const { KEYS } = require('../../config/features');
const { fail } = require('../../lib/http');
const { clip } = require('../../lib/input');
const features = require('../../repositories/central/features.repo');
const restaurants = require('../../repositories/central/restaurants.repo');
const { validateLimits } = require('../restaurants/limits');
const catalog = require('./catalog');
const { notify } = require('./notify');

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,29}$/;
const BUILT_IN = 'trial';      // restaurants start on it and the trial-expiry rules look for it
const slugify = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

function clean(body = {}) {
  const name = clip(body.name, 60);
  if (!name) fail(400, 'Give the subscription a name.');
  let limits;
  try { limits = validateLimits(body.limits); } catch (e) { return fail(400, e.message); }
  const disabled = Array.isArray(body.disabled) ? body.disabled : [];
  const unknown = disabled.find(key => !KEYS.has(key));
  if (unknown !== undefined) fail(400, `Unknown feature: ${unknown}`);
  return {
    name, description: clip(body.description, 300),
    limits_json: JSON.stringify(limits), disabled_json: JSON.stringify([...new Set(disabled)]),
  };
}

/** Every subscription with how many restaurants use it. */
function list() {
  const used = new Map(features.planUsage().map(r => [r.plan, r.n]));
  return [...catalog.load().subs.values()].map(s => ({
    slug: s.slug, name: s.name, description: s.description, limits: s.limits, disabled: [...s.disabled], restaurants: used.get(s.slug) || 0,
  }));
}

const one = (slug) => list().find(s => s.slug === slug);

function create(body = {}) {
  const fields = clean(body);
  const slug = body.slug ? String(body.slug).trim().toLowerCase() : slugify(fields.name);
  if (!SLUG_RE.test(slug)) fail(400, 'Use letters, numbers, dashes or underscores for the short name.');
  if (features.subscriptionBySlug(slug)) fail(409, 'A subscription with this short name already exists.');
  features.insertSubscription({ slug, ...fields, now: new Date().toISOString() });
  catalog.clear();
  return one(slug);
}

function update(slug, body) {
  if (!features.subscriptionBySlug(slug)) fail(404, 'Subscription not found.');
  features.updateSubscription(slug, clean(body), new Date().toISOString());
  catalog.clear();
  notify(restaurants.idsOnPlan(slug));
  return one(slug);
}

function remove(slug) {
  if (!features.subscriptionBySlug(slug)) fail(404, 'Subscription not found.');
  if (slug === BUILT_IN) fail(400, 'The trial subscription is built in and cannot be deleted.');
  const used = features.restaurantsOnPlan(slug);
  if (used > 0) fail(409, `${used} restaurant(s) still use this subscription. Move them to another one first.`);
  features.removeSubscription(slug);
  catalog.clear();
}

module.exports = { list, create, update, remove };
