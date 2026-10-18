'use strict';
module.exports = (db) => db.exec(`
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
`);
