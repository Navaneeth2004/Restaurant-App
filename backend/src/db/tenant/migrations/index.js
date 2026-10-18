'use strict';
/** Tenant (per-restaurant) schema history. Add a NEW numbered file here for every schema change. */
const { runMigrations } = require('../../sqlite-utils');

const MIGRATIONS = [
  require('./001-baseline'),
  require('./002-hash-pins'),
  require('./003-invoices-and-session-activity'),
];

module.exports = { migrate: (db) => runMigrations(db, MIGRATIONS), count: MIGRATIONS.length };
