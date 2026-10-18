'use strict';
/** Creates a restaurant: its own database file plus the central rows. Rolls the file back if the central insert fails. */
const tenants = require('../../db/tenant/manager');
const restaurants = require('../../repositories/central/restaurants.repo');
const { newRestaurantId } = require('../../lib/ids');

/**
 * @param newOwner  { id, phone, passwordHash } to create the owner in the same transaction, OR
 * @param ownerId   an existing owner's id
 * @returns { id }
 */
function createRestaurant({ newOwner, ownerId, name, adminName, adminPinHash, plan = 'trial', trialDays = 30, notes = null }) {
  const id = newRestaurantId();
  let dbFile = null;
  try {
    dbFile = tenants.create({ id, restaurantName: name, adminName, adminPinHash });
    restaurants.createWithOwner({
      owner: newOwner || null,
      restaurant: {
        id, ownerId: newOwner ? newOwner.id : ownerId, name, dbFile, plan, notes,
        trialEndsAt: plan === 'trial' ? new Date(Date.now() + trialDays * 86400000).toISOString() : null,
        now: new Date().toISOString(),
      },
    });
    return { id };
  } catch (e) {
    if (dbFile) tenants.remove(dbFile);
    throw e;
  }
}

module.exports = { createRestaurant };
