'use strict';
/** Subscriptions (named bundles of limits + switched-off features), global feature switches, per-restaurant feature overrides. */
const { addColumn } = require('../../sqlite-utils');

const BUILT_IN = [['trial', 'Trial'], ['standard', 'Standard'], ['premium', 'Premium']];

module.exports = (db) => {
  addColumn(db, 'restaurants', 'feature_overrides_json', 'TEXT');   // { "<feature>": true | false }: beats the subscription
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      limits_json TEXT NOT NULL DEFAULT '{}',
      disabled_json TEXT NOT NULL DEFAULT '[]',     -- features switched OFF: a feature added later is ON by default
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feature_switches (
      feature TEXT PRIMARY KEY, message TEXT, updated_at TEXT NOT NULL     -- a row = switched off for every restaurant
    );
  `);
  const now = new Date().toISOString();
  const seed = db.prepare('INSERT OR IGNORE INTO subscriptions (slug, name, created_at, updated_at) VALUES (?, ?, ?, ?)');
  for (const [slug, name] of BUILT_IN) seed.run(slug, name, now, now);
  for (const { plan } of db.prepare('SELECT DISTINCT plan FROM restaurants').all()) seed.run(plan, plan, now, now);
};
