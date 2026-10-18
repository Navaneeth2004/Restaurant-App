'use strict';
const { addColumn } = require('../../sqlite-utils');

module.exports = (db) => {
  addColumn(db, 'owners', 'role', "TEXT NOT NULL DEFAULT 'owner'");        // 'owner' (customer) | 'root' (operator)
  addColumn(db, 'restaurants', 'limits_json', 'TEXT');                     // per-restaurant overrides of plan limits
  addColumn(db, 'restaurants', 'meta_json', 'TEXT');                       // free-form room for future fields
  addColumn(db, 'restaurants', 'notes', 'TEXT');
  addColumn(db, 'restaurants', 'suspended_reason', 'TEXT');
  addColumn(db, 'restaurants', 'suspended_at', 'TEXT');
  addColumn(db, 'restaurants', 'updated_at', 'TEXT');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id TEXT NOT NULL, restaurant_name TEXT,
      title TEXT NOT NULL, description TEXT NOT NULL, steps_json TEXT,
      severity TEXT, category TEXT,
      status TEXT NOT NULL DEFAULT 'open',          -- open | in_progress | resolved | closed
      root_note TEXT,
      submitted_by TEXT, submitted_role TEXT, device_id TEXT, device_name TEXT, ip TEXT, user_agent TEXT,
      diagnostics_json TEXT, screenshot_file TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_tickets_restaurant ON tickets(restaurant_id);

    CREATE TABLE IF NOT EXISTS root_sessions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL, ip TEXT, user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS root_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL,
      owner_id TEXT, owner_phone TEXT, action TEXT NOT NULL, target TEXT, detail TEXT, ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_root_audit_at ON root_audit(at);
  `);
};
