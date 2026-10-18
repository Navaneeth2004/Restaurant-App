'use strict';
/** The root console creates a restaurant (and its owner account, when new) on a customer's behalf. */
const bcrypt = require('bcryptjs');
const cfg = require('../../config/env');
const { PLANS } = require('../../config/plans');
const { fail } = require('../../lib/http');
const { clip } = require('../../lib/input');
const { phoneVariants } = require('../../lib/phone');
const { pinProblem } = require('../../lib/pin-rules');
const { randomToken, randomDigits, uuid } = require('../../lib/crypto');
const owners = require('../../repositories/central/owners.repo');
const providers = require('../auth/providers');
const { createRestaurant } = require('../restaurants/create');

/** A random 4-digit PIN that passes the PIN rules. */
function randomPin() {
  for (let i = 0; i < 50; i++) { const p = randomDigits(4); if (!pinProblem(p)) return p; }
  return '4729';
}

/** @returns { id, name, owner_phone, temp_owner_password, admin_pin } (the last two are shown ONCE) */
async function createForOwner(body = {}) {
  const name = clip(body.restaurant_name, 60);
  if (!name) fail(400, 'Restaurant name is required.');
  const phones = phoneVariants(body.owner_phone, cfg.DEFAULT_COUNTRY_CODE);
  if (!phones.length) fail(400, 'Enter a valid owner phone number.');
  const plan = body.plan || 'trial';
  if (!PLANS[plan]) fail(400, 'Unknown plan.');

  let adminPin = String(body.admin_pin || '');
  const generatedPin = !adminPin;
  if (generatedPin) adminPin = randomPin();
  const pinErr = pinProblem(adminPin);
  if (pinErr) fail(400, pinErr);

  const existing = owners.byPhones(phones);
  if (existing && existing.role !== 'owner') fail(400, 'That phone number belongs to a root account.');

  const provider = providers.get('password');
  let newOwner = null, tempPassword = null;
  if (!existing) {
    const password = body.owner_password ? String(body.owner_password) : randomToken(9);
    const pwErr = provider.validateNew(password);
    if (pwErr) fail(400, pwErr);
    newOwner = { id: uuid(), phone: phones[0], passwordHash: await provider.hash(password) };
    if (!body.owner_password) tempPassword = password;     // only echo a password the operator did not type
  }

  const trialDays = body.trial_days === undefined || body.trial_days === '' ? 30 : Math.max(0, parseInt(body.trial_days, 10) || 0);
  const { id } = createRestaurant({
    newOwner, ownerId: existing && existing.id, name, plan, trialDays,
    adminName: clip(body.admin_name, 40) || 'Admin', adminPinHash: await bcrypt.hash(adminPin, 10),
    notes: body.notes ? clip(body.notes, 2000) : null,
  });
  return { id, name, owner_phone: phones[0], plan, temp_owner_password: tempPassword, admin_pin: generatedPin ? adminPin : null };
}

module.exports = { createForOwner };
