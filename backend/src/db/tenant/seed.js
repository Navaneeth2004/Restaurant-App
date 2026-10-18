'use strict';
/** Seeding shared by "new restaurant" and "factory reset". Works with a raw handle or the db proxy. */
const D = require('../../config/defaults');

/** Writes the default settings. `overwrite` replaces existing values; `except` lists keys to leave alone. */
function applySettings(db, { overwrite = false, except = [] } = {}) {
  const sql = overwrite ? 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
                        : 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)';
  const stmt = db.prepare(sql);
  for (const [key, value] of Object.entries(D.DEFAULT_SETTINGS)) if (!except.includes(key)) stmt.run(key, value);
}

function seedCategories(db) {
  const insert = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
  D.DEFAULT_CATEGORIES.forEach((name, i) => insert.run(name, i));
}

function seedTables(db) {
  const insert = db.prepare('INSERT INTO tables (id, label, seats, sort_order) VALUES (?, ?, ?, ?)');
  for (let i = 1; i <= D.DEFAULT_TABLE_COUNT; i++) insert.run(`T${i}`, `Table ${i}`, D.seatsForDefaultTable(i), i);
}

function seedItems(db) {
  const ids = Object.fromEntries(db.prepare('SELECT id, name FROM categories').all().map(r => [r.name, r.id]));
  const insert = db.prepare('INSERT INTO menu_items (name, description, price, category_id, sort_order) VALUES (?, ?, ?, ?, ?)');
  D.DEFAULT_ITEMS.forEach(([name, desc, price, cat], i) => insert.run(name, desc, price, ids[cat], i + 1));
}

/** First-time contents of a new restaurant database (schema must already be migrated). */
function seedNewRestaurant(raw, { restaurantName, adminName, adminPinHash }) {
  applySettings(raw);
  if (restaurantName) {
    raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('restaurant_name', ?)").run(String(restaurantName).slice(0, 60));
  }
  if (!raw.prepare('SELECT COUNT(*) AS c FROM categories').get().c) seedCategories(raw);
  if (!raw.prepare('SELECT COUNT(*) AS c FROM tables').get().c) seedTables(raw);
  if (!raw.prepare('SELECT COUNT(*) AS c FROM menu_items').get().c) seedItems(raw);
  if (adminPinHash && !raw.prepare('SELECT 1 FROM staff LIMIT 1').get()) {
    raw.prepare('INSERT INTO staff (name, pin, role, active) VALUES (?, ?, ?, 1)')
      .run(String(adminName || 'Admin').trim().slice(0, 40), adminPinHash, 'admin');
  }
}

module.exports = { applySettings, seedCategories, seedTables, seedItems, seedNewRestaurant };
