'use strict';
/**
 * Tenant manager: one SQLite file per restaurant.
 *
 *   DATA_DIR/accounts.db            central accounts
 *   DATA_DIR/tenants/<id>.db        restaurant <id>'s data
 *
 * Handles are opened on demand, migrated, cached, and the least recently used
 * ones are closed when more than MAX_OPEN_TENANTS are open.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const cfg = require('./config');
const central = require('./central');
const { migrate, seedDefaults } = require('./schema');

const open = new Map(); // restaurantId -> { id, raw, stmts, lastUsed }

function openRaw(file) {
  const raw = new Database(file);
  raw.pragma('journal_mode = WAL');
  raw.pragma('synchronous = NORMAL');
  raw.pragma('busy_timeout = 5000');
  // The existing routes were written without foreign-key enforcement
  raw.pragma('foreign_keys = OFF');
  return raw;
}

function evictIfNeeded(keepId) {
  while (open.size > cfg.MAX_OPEN_TENANTS) {
    let oldest = null;
    for (const h of open.values()) {
      if (h.id === keepId) continue;
      if (!oldest || h.lastUsed < oldest.lastUsed) oldest = h;
    }
    if (!oldest) return;
    try { oldest.raw.close(); } catch (_) {}
    open.delete(oldest.id);
  }
}

/** Returns { id, raw, stmts } for a restaurant, or null if it does not exist. */
function get(id) {
  let h = open.get(id);
  if (h) { h.lastUsed = Date.now(); return h; }

  const row = central.prepare('SELECT id, db_file FROM restaurants WHERE id = ?').get(id);
  if (!row) return null;

  const raw = openRaw(path.join(cfg.TENANT_DIR, row.db_file));
  migrate(raw);
  h = { id, raw, stmts: new Map(), lastUsed: Date.now() };
  open.set(id, h);
  evictIfNeeded(id);
  return h;
}

function databaseFor(id) {
  const tenant = get(id);
  if (!tenant) throw new Error('Restaurant database not found');
  return tenant.raw;
}

/** Creates the database file for a new restaurant. Returns the file name. */
function create({ id, restaurantName, adminName, adminPinHash }) {
  const file = `${id}.db`;
  const full = path.join(cfg.TENANT_DIR, file);
  if (fs.existsSync(full)) throw new Error('Restaurant database already exists');
  const raw = openRaw(full);
  try {
    migrate(raw);
    seedDefaults(raw, { restaurantName, adminName, adminPinHash });
  } finally {
    raw.close();
  }
  return file;
}

function remove(file) {
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(path.join(cfg.TENANT_DIR, file + suffix)); } catch (_) {}
  }
}

/** Close one restaurant's handle (it is reopened automatically on next use). */
function close(id) {
  const h = open.get(id);
  if (h) { try { h.raw.close(); } catch (_) {} open.delete(id); }
}

function closeAll() {
  for (const h of open.values()) { try { h.raw.close(); } catch (_) {} }
  open.clear();
}

/** Kiosk (customer QR) tokens start with the restaurant id so a request can be routed. */
function newKioskToken(restaurantId) {
  return restaurantId + crypto.randomBytes(24).toString('base64url');
}
function restaurantIdFromKioskToken(token) {
  const t = String(token || '');
  const uuid = t.match(/^([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})/i);
  if (uuid && t.length >= uuid[1].length + 20) return uuid[1];
  return /^[a-f0-9]{10}/.test(t) && t.length >= 20 ? t.slice(0, 10) : null;
}

module.exports = { get, databaseFor, create, remove, close, closeAll, newKioskToken, restaurantIdFromKioskToken };