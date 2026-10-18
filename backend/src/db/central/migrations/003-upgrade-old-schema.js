'use strict';
/** Brings databases created by the previous central schema up to the cloud schema. */
const { addColumn, hasColumn } = require('../../sqlite-utils');

const COLUMNS = {
  owners: [
    ['password_hash', 'TEXT'], ['disabled', 'INTEGER NOT NULL DEFAULT 0'],
    ['created_at', "TEXT NOT NULL DEFAULT ''"], ['updated_at', 'TEXT'],
  ],
  restaurants: [
    ['db_file', 'TEXT'], ['status', "TEXT NOT NULL DEFAULT 'active'"], ['plan', "TEXT NOT NULL DEFAULT 'trial'"],
    ['trial_ends_at', 'TEXT'], ['created_at', "TEXT NOT NULL DEFAULT ''"], ['limits_json', 'TEXT'],
    ['meta_json', 'TEXT'], ['notes', 'TEXT'], ['suspended_reason', 'TEXT'], ['suspended_at', 'TEXT'], ['updated_at', 'TEXT'],
  ],
  devices: [
    ['secret_hash', 'TEXT'], ['role_lock', 'TEXT'], ['created_via', 'TEXT'], ['created_at', "TEXT NOT NULL DEFAULT ''"],
    ['last_seen_at', 'TEXT'], ['last_ip', 'TEXT'], ['user_agent', 'TEXT'], ['revoked_at', 'TEXT'],
  ],
};

module.exports = (db) => {
  for (const [table, cols] of Object.entries(COLUMNS)) for (const [name, decl] of cols) addColumn(db, table, name, decl);

  if (hasColumn(db, 'devices', 'token_hash')) db.exec('UPDATE devices SET secret_hash = token_hash WHERE secret_hash IS NULL');
  db.exec(`
    UPDATE owners SET updated_at = created_at WHERE updated_at IS NULL;
    UPDATE restaurants SET db_file = id || '.db' WHERE db_file IS NULL;
  `);
  if (hasColumn(db, 'restaurants', 'active')) {
    db.exec("UPDATE restaurants SET status = 'suspended' WHERE active = 0 AND status = 'active'");
  }
};
