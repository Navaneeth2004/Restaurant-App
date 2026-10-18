'use strict';
const restaurants = require('../../repositories/central/restaurants.repo');
const limits = require('./limits');

/** { row, state } for a restaurant, or null if it does not exist. */
function accessInfo(id) {
  const row = restaurants.accessRow(id);
  return row ? { row, state: limits.accessState(row) } : null;
}

/** The restaurant row if it may currently be used, otherwise null. */
function activeRestaurant(id) {
  const info = accessInfo(id);
  return info && info.state.allowed ? info.row : null;
}

module.exports = { accessInfo, activeRestaurant };
