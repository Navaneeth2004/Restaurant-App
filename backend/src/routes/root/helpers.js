'use strict';
const restaurantsRepo = require('../../repositories/central/restaurants.repo');
const { fail } = require('../../lib/http');

/** Who is acting (for the audit log). */
const actorOf = (req) => ({ owner: req.root && req.root.owner, ip: req.ip });

/** The restaurant named in :id, with its owner's phone, or a 404. */
function restaurantOr404(req) {
  const r = restaurantsRepo.withOwner(String(req.params.id || ''));
  if (!r) fail(404, 'Restaurant not found');
  return r;
}

module.exports = { actorOf, restaurantOr404 };
