'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const cfg = require('./config');

fs.mkdirSync(cfg.DATA_DIR, { recursive: true });
const central = new Database(path.join(cfg.DATA_DIR, 'accounts.db'));
central.pragma('journal_mode = WAL');
central.pragma('foreign_keys = ON');
central.exec(`
  CREATE TABLE IF NOT EXISTS owners (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    restaurant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role_lock TEXT,
    created_via TEXT,
    created_at TEXT NOT NULL,
    last_seen_at TEXT,
    last_ip TEXT,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS pairing_codes (
    code_hash TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    created_by TEXT,
    role_lock TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    used_at TEXT,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
  CREATE INDEX IF NOT EXISTS idx_devices_restaurant ON devices(restaurant_id);
`);

module.exports = central;
