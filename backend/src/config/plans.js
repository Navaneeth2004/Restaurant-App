'use strict';
/**
 * Plans and the limits they can carry.
 * To add a limit: add a key to LIMIT_KEYS, then call limits.check(restaurant, key, current) where it matters.
 * To add a plan: add it to PLANS ({} = no limits). Per-restaurant overrides always win.
 */
const LIMIT_KEYS = {
  max_devices: { label: 'Max linked devices' },
  max_staff:   { label: 'Max staff accounts' },
  max_tables:  { label: 'Max tables' },
};

const PLANS = {
  trial:    {},
  standard: {},   // e.g. later: { max_devices: 5, max_staff: 15 }
  premium:  {},
};

module.exports = { LIMIT_KEYS, PLANS };
