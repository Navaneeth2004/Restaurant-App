'use strict';
/**
 * The limits a subscription can carry. Subscriptions themselves (names, limits, switched-off features) live in the
 * central database and are managed in the root console (services/features/subscriptions.js).
 * To add a limit: add a key to LIMIT_KEYS, then call limits.check(restaurant, key, current) where it matters.
 */
const LIMIT_KEYS = {
  max_devices: { label: 'Max linked devices' },
  max_staff:   { label: 'Max staff accounts' },
  max_tables:  { label: 'Max tables' },
};

module.exports = { LIMIT_KEYS };
