'use strict';
const cfg = require('../../config/env');
const { phoneVariants } = require('../../lib/phone');
const owners = require('../../repositories/central/owners.repo');

/** Throws (the dispatcher prints the message and sets a failing exit code). */
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

function phonesOf(input) {
  const variants = phoneVariants(input, cfg.DEFAULT_COUNTRY_CODE);
  must(variants.length, 'Invalid phone');
  return variants;
}

function ownerByPhone(input) {
  const owner = owners.byPhones(phonesOf(input));
  must(owner, 'No owner with that phone');
  return owner;
}

module.exports = { must, phonesOf, ownerByPhone };
