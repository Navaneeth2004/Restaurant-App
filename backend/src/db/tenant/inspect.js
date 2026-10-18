'use strict';
/** Looks inside a restaurant database FILE that is not (yet) registered: backups and legacy installs. */
const Database = require('better-sqlite3');
const { isHashed } = require('../../lib/pin-rules');

const REQUIRED_TABLES = ['settings', 'categories', 'menu_items', 'tables', 'orders', 'order_items', 'staff'];

function withReadonly(file, fn, fallback) {
  let probe;
  try { probe = new Database(file, { readonly: true }); return fn(probe); }
  catch (_) { return fallback; }
  finally { if (probe) probe.close(); }
}

/** true when the file has the POS tables and at least one active admin */
const looksLikePosBackup = (file) => withReadonly(file, (db) => {
  const have = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name);
  return REQUIRED_TABLES.every(t => have.includes(t)) &&
    db.prepare("SELECT COUNT(*) AS c FROM staff WHERE role = 'admin' AND active = 1").get().c > 0;
}, false);

/** How many staff PINs are still plain text (legacy installs). */
const plainPinCount = (file) => withReadonly(file, (db) =>
  db.prepare('SELECT pin FROM staff').all().filter(s => !isHashed(s.pin)).length, 0);

const restaurantName = (file) => withReadonly(file, (db) =>
  (db.prepare("SELECT value FROM settings WHERE key = 'restaurant_name'").get() || {}).value || null, null);

module.exports = { looksLikePosBackup, plainPinCount, restaurantName };
