'use strict';
/** What a restaurant's admin may see about its own subscription (read-only: there is no payment yet). */
const cfg = require('../../config/env');
const ctx = require('../../db/context');
const { FEATURES } = require('../../config/features');
const catalog = require('../features/catalog');
const limits = require('./limits');

const LABEL = new Map(FEATURES.map(f => [f.key, f.label]));
const excluded = (sub) => [...sub.disabled].map(k => LABEL.get(k)).filter(Boolean);

function subscriptionInfo() {
  const r = ctx.get().restaurant;
  const { subs } = catalog.load();
  const current = subs.get(r.plan);
  return {
    plan: { slug: r.plan, name: current ? current.name : r.plan, description: current ? current.description : '' },
    trial_ends_at: r.plan === 'trial' ? r.trial_ends_at || null : null,
    enforce_trial: cfg.ENFORCE_TRIAL,
    limits: limits.limitsFor(r),
    plans: [...subs.values()].map(s => ({
      slug: s.slug, name: s.name, description: s.description, limits: s.limits,
      features_off: s.disabled.size, features_excluded: excluded(s),
    })),
  };
}

module.exports = { subscriptionInfo };