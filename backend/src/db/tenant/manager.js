'use strict';
/**
 * Tenant manager: one SQLite file per restaurant (DATA_DIR/tenants/<id>.db).
 * Handles are opened on demand, migrated, cached (with a prepared-statement cache) and the
 * least recently used are closed once more than MAX_OPEN_TENANTS are open.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const cfg = require('../../config/env');
const central = require('../central');
const { migrate } = require('./migrations');
const { seedNewRestaurant } = require('./seed');

const STATEMENT_CACHE_MAX = 400;
const open = new Map(); // restaurantId -> { id, raw, lastUsed, prepared(sql) }

function openRaw(file) {
  const raw = new Database(file);
  raw.pragma('journal_mode = WAL');
  raw.pragma('synchronous = NORMAL');
  raw.pragma('busy_timeout = 5000');
  raw.pragma('foreign_keys = ON');
  return raw;
}

function makeHandle(id, raw) {
  const statements = new Map();
  return {
    id, raw, lastUsed: Date.now(),
    prepared(sql) {
      let st = statements.get(sql);
      if (!st) {
        if (statements.size >= STATEMENT_CACHE_MAX) statements.clear();
        st = raw.prepare(sql);
        statements.set(sql, st);
      }
      return st;
    },
  };
}

function evictIfNeeded(keepId) {
  while (open.size > cfg.MAX_OPEN_TENANTS) {
    let oldest = null;
    for (const h of open.values()) if (h.id !== keepId && (!oldest || h.lastUsed < oldest.lastUsed)) oldest = h;
    if (!oldest) return;
    try { oldest.raw.close(); } catch (_) { /* already closed */ }
    open.delete(oldest.id);
  }
}

/** Handle for a restaurant, or null if it does not exist. */
function get(id) {
  let h = open.get(id);
  if (h) { h.lastUsed = Date.now(); return h; }

  const row = central.prepare('SELECT id, db_file FROM restaurants WHERE id = ?').get(id);
  if (!row) return null;

  const raw = openRaw(path.join(cfg.TENANT_DIR, row.db_file));
  migrate(raw);
  h = makeHandle(id, raw);
  open.set(id, h);
  evictIfNeeded(id);
  return h;
}

/** Creates the database file for a new restaurant. Returns the file name. */
function create({ id, restaurantName, adminName, adminPinHash }) {
  const file = `${id}.db`;
  const full = path.join(cfg.TENANT_DIR, file);
  if (fs.existsSync(full)) throw new Error('Restaurant database already exists');
  const raw = openRaw(full);
  try {
    migrate(raw);
    seedNewRestaurant(raw, { restaurantName, adminName, adminPinHash });
  } finally {
    raw.close();
  }
  return file;
}

function remove(file) {
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(path.join(cfg.TENANT_DIR, file + suffix)); } catch (_) { /* not there */ }
  }
}

/** Close one restaurant's handle (it is reopened automatically on next use). */
function close(id) {
  const h = open.get(id);
  if (h) { try { h.raw.close(); } catch (_) { /* already closed */ } open.delete(id); }
}

function closeAll() {
  for (const h of open.values()) { try { h.raw.close(); } catch (_) { /* already closed */ } }
  open.clear();
}

module.exports = { get, create, remove, close, closeAll, openRaw };
