'use strict';
/** Suspend / activate / delete a restaurant, reset an owner's password. Shared by the root console AND the CLI. */
const tenants = require('../../db/tenant/manager');
const restaurants = require('../../repositories/central/restaurants.repo');
const owners = require('../../repositories/central/owners.repo');
const { fail } = require('../../lib/http');
const { randomToken } = require('../../lib/crypto');
const providers = require('../auth/providers');
const files = require('../files/paths');
const deviceService = require('../devices/devices');
const bus = require('../../realtime/bus');

const now = () => new Date().toISOString();

function requireRestaurant(id) {
  const r = restaurants.byId(id);
  if (!r) fail(404, 'Restaurant not found');
  return r;
}

function suspend(id, reason) {
  requireRestaurant(id);
  restaurants.suspend(id, String(reason || '').trim().slice(0, 200) || null, now());
  bus.kickRestaurant(id);
}

function activate(id) {
  requireRestaurant(id);
  restaurants.activate(id, now());
}

/** @returns how many devices were revoked */
function revokeDevices(id) {
  requireRestaurant(id);
  return deviceService.revokeAll(id);
}

/** @returns the generated password when none was given */
async function setOwnerPassword(ownerId, provided) {
  const provider = providers.get('password');
  const password = provided ? String(provided) : randomToken(9);
  const problem = provider.validateNew(password);
  if (problem) fail(400, problem);
  owners.setPassword(ownerId, await provider.hash(password), now());
  return provided ? null : password;
}

/** PERMANENT: database file, photos and central rows (tickets are kept as history). */
function deleteRestaurant(id) {
  const r = requireRestaurant(id);
  bus.kickRestaurant(id);
  tenants.close(id);
  restaurants.deleteCentral(id);
  tenants.remove(r.db_file);
  files.removeRestaurantFiles(id);
  return r;
}

module.exports = { requireRestaurant, suspend, activate, revokeDevices, setOwnerPassword, deleteRestaurant };
