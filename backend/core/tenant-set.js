'use strict';
/**
 * Drop-in replacement for `new Set()` used as an in-flight lock
 * ("this table is already being processed"). Keys are automatically prefixed with the
 * current restaurant, so two restaurants that both have a table "T1" never block each other.
 *     const _pendingTables = require('../core/tenant-set')();
 */
const ctx = require('./context');

module.exports = function tenantSet() {
  const s = new Set();
  const k = (key) => `${(ctx.get() || {}).restaurantId || '-'}:${key}`;
  return {
    has:    (key) => s.has(k(key)),
    add:    (key) => { s.add(k(key)); return undefined; },
    delete: (key) => s.delete(k(key)),
  };
};