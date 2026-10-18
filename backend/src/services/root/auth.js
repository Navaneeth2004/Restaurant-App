'use strict';
const cfg = require('../../config/env');
const { fail } = require('../../lib/http');
const { phoneVariants } = require('../../lib/phone');
const { failTracker } = require('../../lib/fail-tracker');
const owners = require('../../repositories/central/owners.repo');
const providers = require('../auth/providers');
const audit = require('./audit');

const loginFails = failTracker({ max: 5, windowMs: 15 * 60 * 1000, lockMs: 30 * 60 * 1000 });

/** @returns the root owner row */
async function login(body = {}, ip) {
  const phones = phoneVariants(body.phone, cfg.DEFAULT_COUNTRY_CODE);
  const key = `root|${ip}`;
  const wait = loginFails.check(key);
  if (wait) fail(429, `Too many attempts. Try again in ${Math.ceil(wait / 60000)} minute(s).`);

  let owner = null;
  for (const p of phones) { owner = owners.activeRootByPhone(p); if (owner) break; }
  if (!(await providers.get('password').verify(owner, body))) {
    loginFails.fail(key);
    audit.record({ ip }, 'root.login_failed', phones[0] || 'invalid');
    fail(401, 'Incorrect phone number or password.');
  }
  loginFails.reset(key);
  return owner;
}

/** Re-checks the logged-in root user's password before a dangerous action. */
async function confirmPassword(ownerId, password) {
  const me = owners.byId(ownerId);
  return providers.get('password').verify(me, { password });
}

module.exports = { login, confirmPassword };
