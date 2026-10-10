'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const cfg = require('./config');
const central = require('./central');
const schema = require('./schema');

const tenantDir = path.join(cfg.DATA_DIR, 'tenants');
fs.mkdirSync(tenantDir, { recursive: true });
const databases = new Map();

function tenantPath(id) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(id))) throw new Error('Invalid restaurant id');
  return path.join(tenantDir, `${id}.db`);
}

function databaseFor(id) {
  if (!id) throw new Error('Restaurant id is required');
  if (databases.has(id)) return databases.get(id);
  const db = new Database(tenantPath(id));
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    schema.initialize(db);
    databases.set(id, db);
    return db;
  } catch (err) {
    db.close();
    throw err;
  }
}

function createRestaurantDatabase(id, options = {}) {
  const db = databaseFor(id);
  if (options.restaurantName) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('restaurant_name', ?)")
      .run(String(options.restaurantName).slice(0, 60));
  }
  if (options.admin) {
    schema.initialize(db, {
      restaurantName: options.restaurantName,
      admin: options.admin,
    });
  }
  return db;
}

function restaurantIdFromKioskToken(token) {
  if (!token) return null;
  const restaurants = central.prepare('SELECT id FROM restaurants WHERE active = 1').all();
  for (const { id } of restaurants) {
    const row = databaseFor(id).prepare('SELECT id FROM tables WHERE kiosk_token = ?').get(token);
    if (row) return id;
  }
  return null;
}

function closeAll() {
  for (const db of databases.values()) db.close();
  databases.clear();
}

function removeRestaurantDatabase(id) {
  const file = tenantPath(id);
  const db = databases.get(id);
  if (db) {
    db.close();
    databases.delete(id);
  }
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

module.exports = {
  databaseFor, createRestaurantDatabase, restaurantIdFromKioskToken,
  closeAll, removeRestaurantDatabase, tenantPath,
};
