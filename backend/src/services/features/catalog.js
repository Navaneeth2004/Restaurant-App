'use strict';
/** Subscriptions and global switches, cached for a few seconds (every request asks). Root changes call clear(). */
const { parseJson } = require('../../lib/json');
const features = require('../../repositories/central/features.repo');

const TTL_MS = 3000;
let cached = null;

function subscriptionOf(row) {
  const disabled = parseJson(row.disabled_json, []);
  const limits = parseJson(row.limits_json, {});
  return {
    slug: row.slug, name: row.name, description: row.description || '',
    limits: limits && typeof limits === 'object' && !Array.isArray(limits) ? limits : {},
    disabled: new Set(Array.isArray(disabled) ? disabled : []),
  };
}

/** @returns { switches: Map<feature, message|null>, subs: Map<slug, {slug, name, description, limits, disabled:Set}> } */
function load() {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached;
  cached = {
    at: now,
    switches: new Map(features.listSwitches().map(s => [s.feature, s.message])),
    subs: new Map(features.listSubscriptions().map(row => [row.slug, subscriptionOf(row)])),
  };
  return cached;
}

const clear = () => { cached = null; };

module.exports = { load, clear };
