'use strict';
/** Tells the devices of some restaurants (even before a PIN) to re-read which features are on. */
const bus = require('../../realtime/bus');
const events = require('../../realtime/order-events');
const restaurants = require('../../repositories/central/restaurants.repo');

function notify(restaurantIds) {
  for (const id of restaurantIds) events.featuresUpdated({ emit: (event, data) => bus.emit(id, event, data) });
}

const notifyAll = () => notify(restaurants.idsAndFiles().map(r => r.id));

module.exports = { notify, notifyAll };
