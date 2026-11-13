'use strict';
/** Looks inside a restaurant database FILE that is not (yet) registered: backups and legacy installs. */
const Database = require('better-sqlite3');
const { isHashed } = require('../../lib/pin-rules');
const { hasColumn } = require('../sqlite-utils');

const REQUIRED_TABLES = ['settings', 'categories', 'menu_items', 'tables', 'orders', 'order_items', 'staff'];
const REQUIRED_COLUMNS = {
  settings: ['key', 'value'],
  categories: ['id', 'name', 'sort_order'],
  menu_items: ['id', 'name', 'price', 'category_id', 'available', 'sort_order'],
  tables: ['id', 'label', 'seats', 'status', 'is_parcel', 'is_archived', 'kiosk_token'],
  orders: ['id', 'table_id', 'status', 'created_at', 'total', 'session_id', 'invoice_no', 'closed_at'],
  order_items: ['id', 'order_id', 'menu_item_id', 'name', 'price', 'quantity'],
  staff: ['id', 'name', 'pin', 'role', 'active'],
  staff_sessions: ['staff_id', 'token'],
  deleted_records: ['id', 'deleted_at'],
};

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

/**
 * Deep check of a STAGED COPY (it is migrated in place): integrity, schema version, every required column.
 * @returns { error: string|null, staffActive, tables }
 */
function validateBackup(file) {
  let db;
  try {
    const { migrate, count } = require('./migrations');
    db = new Database(file);
    db.pragma('trusted_schema = OFF');
    if (db.pragma('quick_check', { simple: true }) !== 'ok') return { error: 'The backup database is damaged.' };
    if (db.pragma('user_version', { simple: true }) > count) return { error: 'This backup comes from a newer version of the app.' };
    migrate(db);
    for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
      const missing = cols.find(c => !hasColumn(db, table, c));
      if (missing) return { error: `Invalid backup — ${table}.${missing} is missing.` };
    }
    return {
      error: null,
      staffActive: db.prepare('SELECT COUNT(*) AS c FROM staff WHERE active = 1').get().c,
      tables: db.prepare('SELECT COUNT(*) AS c FROM tables WHERE (is_archived IS NULL OR is_archived = 0) AND (is_parcel IS NULL OR is_parcel = 0)').get().c,
    };
  } catch (_) {
    return { error: 'This does not look like a valid POS backup.' };
  } finally {
    if (db) { try { db.close(); } catch (_) { /* closed */ } }
  }
}

/** How many staff PINs are still plain text (legacy installs). */
const plainPinCount = (file) => withReadonly(file, (db) =>
  db.prepare('SELECT pin FROM staff').all().filter(s => !isHashed(s.pin)).length, 0);

const restaurantName = (file) => withReadonly(file, (db) =>
  (db.prepare("SELECT value FROM settings WHERE key = 'restaurant_name'").get() || {}).value || null, null);

module.exports = { looksLikePosBackup, validateBackup, plainPinCount, restaurantName };
