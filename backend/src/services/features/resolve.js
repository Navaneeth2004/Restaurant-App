'use strict';
/**
 * Is a feature on for a restaurant? The global switch wins, then the restaurant's own override, then its subscription.
 * A feature nobody switched off is ON (so a newly added feature is available to everyone).
 */
const { FEATURES } = require('../../config/features');
const { parseJson } = require('../../lib/json');
const catalog = require('./catalog');

const NOT_AVAILABLE = 'This feature is not available for this restaurant.';
const SWITCHED_OFF = 'This feature is temporarily switched off. Please try again later.';

function overridesOf(restaurant) {
  const parsed = parseJson(restaurant.feature_overrides_json, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

/** @returns { on, source: 'global'|'restaurant'|'plan'|null, feature?, message? } */
function stateOf(restaurant, key, cat, overrides) {
  if (cat.switches.has(key)) return { on: false, source: 'global', feature: key, message: cat.switches.get(key) || SWITCHED_OFF };
  if (overrides[key] === true) return { on: true, source: 'restaurant' };
  if (overrides[key] === false) return { on: false, source: 'restaurant', feature: key, message: NOT_AVAILABLE };
  const sub = cat.subs.get(restaurant.plan);
  if (sub && sub.disabled.has(key)) return { on: false, source: 'plan', feature: key, message: NOT_AVAILABLE };
  return { on: true, source: null };
}

/** null when ANY of `keys` is on, otherwise { feature, message } of the first one (a read shared by several screens lists them all). */
function blockedBy(restaurant, keys) {
  const cat = catalog.load();
  const overrides = overridesOf(restaurant);
  let first = null;
  for (const key of keys) {
    const state = stateOf(restaurant, key, cat, overrides);
    if (state.on) return null;
    first = first || state;
  }
  return first && { feature: first.feature, message: first.message };
}

/** { "<feature>": "<message>" } for every feature that is OFF (what the app hides). */
function disabledFor(restaurant) {
  const cat = catalog.load();
  const overrides = overridesOf(restaurant);
  const out = {};
  for (const { key } of FEATURES) {
    const state = stateOf(restaurant, key, cat, overrides);
    if (!state.on) out[key] = state.message;
  }
  return out;
}

/** { "<feature>": { on, source } } for the root console. */
function effectiveFor(restaurant) {
  const cat = catalog.load();
  const overrides = overridesOf(restaurant);
  return Object.fromEntries(FEATURES.map(({ key }) => {
    const { on, source } = stateOf(restaurant, key, cat, overrides);
    return [key, { on, source }];
  }));
}

module.exports = { blockedBy, disabledFor, effectiveFor };
