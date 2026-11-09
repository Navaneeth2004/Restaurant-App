'use strict';
/**
 * Which switchable feature(s) a staff route belongs to. routes/index.js refuses to boot when an any/floor/admin route has none.
 *   feature.of('admin.menu')              allowed while that feature is on for the caller's restaurant
 *   feature.of('waiter', 'admin.floor')   allowed while ANY of them is on (a read used by several screens)
 * Root decides what is on (subscription, per-restaurant override, global switch): services/features/resolve.js.
 */
const ctx = require('../db/context');
const { fail } = require('../lib/http');
const { KEYS } = require('../config/features');
const { blockedBy } = require('../services/features/resolve');

function of(...keys) {
  for (const key of keys) if (!KEYS.has(key)) throw new Error(`Unknown feature: ${key}`);
  const guard = (req, res, next) => {
    const { restaurant } = ctx.get();
    const block = restaurant ? blockedBy(restaurant, keys) : null;
    if (block) fail(403, block.message, { code: 'feature_disabled', feature: block.feature });
    return next();
  };
  guard.featureKeys = keys;
  return guard;
}

module.exports = { of };
