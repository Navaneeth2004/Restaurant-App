'use strict';
/**
 * Central accounts database (accounts.db): owners/root accounts, restaurants, devices, pairing codes,
 * support tickets, root sessions and the audit log. Never holds orders or menu data.
 * Schema changes: add a NEW numbered file in ./migrations and list it in migrations/index.js (never edit an old one).
 */
const central = require('./connection');
const migrations = require('./migrations');
const { runMigrations } = require('../sqlite-utils');

runMigrations(central, migrations);

module.exports = central;
