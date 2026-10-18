'use strict';
/** Barrier 1: the owner proves who they are (phone + password) so a device can be linked to a restaurant. */
const bcrypt = require('bcryptjs');
const cfg = require('../../config/env');
const { fail } = require('../../lib/http');
const { clip } = require('../../lib/input');
const { phoneVariants } = require('../../lib/phone');
const { pinProblem } = require('../../lib/pin-rules');
const { uuid } = require('../../lib/crypto');
const { failTracker } = require('../../lib/fail-tracker');
const owners = require('../../repositories/central/owners.repo');
const restaurants = require('../../repositories/central/restaurants.repo');
const providers = require('./providers');
const limits = require('../restaurants/limits');
const { createRestaurant } = require('../restaurants/create');

const loginFails = failTracker({ max: 5, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 });
const publicRestaurant = (r) => ({ id: r.id, name: r.name });

/** Self-service sign-up. @returns { id, name } of the new restaurant (the caller links the device) */
async function register(body = {}) {
  if (!cfg.ALLOW_REGISTRATION) fail(403, 'New sign-ups are closed.');
  const phones = phoneVariants(body.phone, cfg.DEFAULT_COUNTRY_CODE);
  if (!phones.length) fail(400, 'Enter a valid phone number.');

  const provider = providers.get('password');
  const pwErr = provider.validateNew(body.password);
  if (pwErr) fail(400, pwErr);

  const name = clip(body.restaurant_name, 60);
  const adminName = clip(body.admin_name, 40);
  if (!name) fail(400, 'Enter the restaurant name.');
  if (!adminName) fail(400, 'Enter your name.');
  const pinErr = pinProblem(body.admin_pin);
  if (pinErr) fail(400, pinErr);

  if (owners.byPhones(phones)) fail(409, 'An account with this phone number already exists. Please log in instead.');

  const [passwordHash, adminPinHash] = await Promise.all([provider.hash(body.password), bcrypt.hash(String(body.admin_pin), 10)]);
  const { id } = createRestaurant({ newOwner: { id: uuid(), phone: phones[0], passwordHash }, name, adminName, adminPinHash });
  return { id, name };
}

/**
 * @returns { restaurant } when one restaurant was chosen, or { choices } when the owner must pick one.
 */
async function login(body = {}, ip) {
  const method = body.method || 'password';
  const provider = cfg.AUTH_METHODS.includes(method) ? providers.get(method) : null;
  if (!provider) fail(400, 'This login method is not available.');

  const phones = phoneVariants(body.phone, cfg.DEFAULT_COUNTRY_CODE);
  const failKey = `${ip}|${phones[0] || 'x'}`;
  const wait = loginFails.check(failKey);
  if (wait) {
    fail(429, `Too many wrong attempts. Try again in ${Math.max(1, Math.ceil(wait / 60000))} minute(s).`, { code: 'locked', retry_after: Math.ceil(wait / 1000) });
  }

  const owner = phones.length ? owners.activeOwnerByPhones(phones) : null;
  if (!(await provider.verify(owner, body))) {
    loginFails.fail(failKey);
    fail(401, 'Incorrect phone number or password.');
  }
  loginFails.reset(failKey);

  const list = restaurants.activeForOwner(owner.id);
  if (!list.length) fail(403, 'There is no active restaurant on this account.');

  let chosen;
  if (body.restaurant_id) {
    chosen = list.find(r => r.id === body.restaurant_id);
    if (!chosen) fail(404, 'Restaurant not found on this account.');
  } else if (list.length === 1) {
    chosen = list[0];
  } else {
    return { choices: list.map(publicRestaurant) };
  }

  if (limits.deviceLimitReached(chosen.id)) fail(403, limits.LIMIT_MSG, { code: 'plan_limit' });
  return { restaurant: publicRestaurant(chosen) };
}

module.exports = { register, login, publicRestaurant };
