'use strict';
/**
 * Central accounts database (accounts.db).
 * Owners / root accounts, restaurants, linked devices, pairing codes, support tickets, root sessions + audit log.
 * It never contains orders/menu data — that lives in each restaurant's own file.
 *
 * Schema changes: add a function at the END of MIGRATIONS (never edit an old one).
 */
const fs = require('fs');
const Database = require('better-sqlite3');
const cfg = require('./config');

fs.mkdirSync(cfg.DATA_DIR, { recursive: true });
fs.mkdirSync(cfg.TENANT_DIR, { recursive: true });

const central = new Database(cfg.CENTRAL_DB);
central.pragma('journal_mode = WAL');
central.pragma('synchronous = NORMAL');
central.pragma('busy_timeout = 5000');
central.pragma('foreign_keys = ON');

const hasColumn = (t, c) => central.prepare(`PRAGMA table_info(${t})`).all().some(r => r.name === c);
const addColumn = (t, c, def) => { if (!hasColumn(t, c)) central.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };

const MIGRATIONS = [
  // 1 ── baseline (owners, restaurants, devices, pairing codes, otp placeholder)
  () => central.exec(`
    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY, phone TEXT NOT NULL UNIQUE, password_hash TEXT,
      disabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES owners(id), name TEXT NOT NULL,
      db_file TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', plan TEXT NOT NULL DEFAULT 'trial',
      trial_ends_at TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id), name TEXT NOT NULL,
      secret_hash TEXT NOT NULL, role_lock TEXT, created_via TEXT, created_at TEXT NOT NULL,
      last_seen_at TEXT, last_ip TEXT, user_agent TEXT, revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_devices_restaurant ON devices(restaurant_id);
    CREATE TABLE IF NOT EXISTS pairing_codes (
      code_hash TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
      role_lock TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS otp_challenges (
      id TEXT PRIMARY KEY, phone TEXT NOT NULL, code_hash TEXT NOT NULL, purpose TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL
    );
  `),

  // 2 ── root console: account roles, plan/limits/notes, support tickets, root sessions, audit log
  () => {
    addColumn('owners', 'role', "TEXT NOT NULL DEFAULT 'owner'");          // 'owner' (customer) | 'root' (you)
    addColumn('restaurants', 'limits_json', 'TEXT');                       // per-restaurant overrides of plan limits
    addColumn('restaurants', 'meta_json', 'TEXT');                         // free-form room for future fields (billing ids, etc.)
    addColumn('restaurants', 'notes', 'TEXT');                             // private notes of the root user
    addColumn('restaurants', 'suspended_reason', 'TEXT');
    addColumn('restaurants', 'suspended_at', 'TEXT');
    addColumn('restaurants', 'updated_at', 'TEXT');
    central.exec(`
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
        id TEXT PRIMARY KEY,                           -- sha256 of the cookie value
        owner_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL, ip TEXT, user_agent TEXT
      );

      CREATE TABLE IF NOT EXISTS root_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL,
        owner_id TEXT, owner_phone TEXT, action TEXT NOT NULL, target TEXT, detail TEXT, ip TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_root_audit_at ON root_audit(at);
    `);
  },

  // 3 ── bring databases from the previous central schema up to the cloud schema
  () => {
    addColumn('owners', 'password_hash', 'TEXT');
    addColumn('owners', 'disabled', 'INTEGER NOT NULL DEFAULT 0');
    addColumn('owners', 'created_at', "TEXT NOT NULL DEFAULT ''");
    addColumn('owners', 'updated_at', 'TEXT');
    addColumn('restaurants', 'db_file', 'TEXT');
    addColumn('restaurants', 'status', "TEXT NOT NULL DEFAULT 'active'");
    addColumn('restaurants', 'plan', "TEXT NOT NULL DEFAULT 'trial'");
    addColumn('restaurants', 'trial_ends_at', 'TEXT');
    addColumn('restaurants', 'created_at', "TEXT NOT NULL DEFAULT ''");
    addColumn('restaurants', 'limits_json', 'TEXT');
    addColumn('restaurants', 'meta_json', 'TEXT');
    addColumn('restaurants', 'notes', 'TEXT');
    addColumn('restaurants', 'suspended_reason', 'TEXT');
    addColumn('restaurants', 'suspended_at', 'TEXT');
    addColumn('restaurants', 'updated_at', 'TEXT');
    addColumn('devices', 'secret_hash', 'TEXT');
    addColumn('devices', 'role_lock', 'TEXT');
    addColumn('devices', 'created_via', 'TEXT');
    addColumn('devices', 'created_at', "TEXT NOT NULL DEFAULT ''");
    addColumn('devices', 'last_seen_at', 'TEXT');
    addColumn('devices', 'last_ip', 'TEXT');
    addColumn('devices', 'user_agent', 'TEXT');
    addColumn('devices', 'revoked_at', 'TEXT');

    if (hasColumn('devices', 'token_hash')) {
      central.exec('UPDATE devices SET secret_hash = token_hash WHERE secret_hash IS NULL');
    }
    central.exec(`
      UPDATE owners SET updated_at = created_at WHERE updated_at IS NULL;
      UPDATE restaurants SET db_file = id || '.db' WHERE db_file IS NULL;
    `);
    if (hasColumn('restaurants', 'active')) {
      central.exec("UPDATE restaurants SET status = 'suspended' WHERE active = 0 AND status = 'active'");
    }
  },

  // 4 ── retain the legacy device hash column for databases where it is NOT NULL
  () => {
    addColumn('devices', 'token_hash', 'TEXT');
  },
];

const current = central.pragma('user_version', { simple: true });
for (let i = current; i < MIGRATIONS.length; i++) {
  central.transaction(() => { MIGRATIONS[i](); central.pragma(`user_version = ${i + 1}`); })();
}

module.exports = central;