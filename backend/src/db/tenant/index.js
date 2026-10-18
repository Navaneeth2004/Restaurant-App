'use strict';
/**
 * `db` = the current request's restaurant database.
 * Repositories import this and just call db.prepare(...); the proxy picks the right file from the
 * request context (db/context.js) and reuses prepared statements.
 */
const ctx = require('../context');
const manager = require('./manager');

module.exports = new Proxy({}, {
  get(_target, property) {
    const restaurantId = ctx.restaurantId();
    if (!restaurantId) throw new Error('Tenant database requested outside a restaurant context');
    const handle = manager.get(restaurantId);
    if (!handle) throw new Error('Restaurant database not found');
    if (property === 'prepare') return (sql) => handle.prepared(sql);
    const value = handle.raw[property];
    return typeof value === 'function' ? value.bind(handle.raw) : value;
  },
});
