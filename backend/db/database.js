'use strict';

const ctx = require('../core/context');
const tenants = require('../core/tenants');

function currentDatabase() {
  const { restaurantId } = ctx.get();
  if (!restaurantId) throw new Error('Tenant database requested outside a restaurant context');
  return tenants.databaseFor(restaurantId);
}

module.exports = new Proxy({}, {
  get(_target, property) {
    const database = currentDatabase();
    const value = database[property];
    return typeof value === 'function' ? value.bind(database) : value;
  },
});
