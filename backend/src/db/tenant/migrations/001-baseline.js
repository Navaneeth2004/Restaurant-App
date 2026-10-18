'use strict';
const ddl = require('../schema-ddl');
const columns = require('../schema-columns');
const { addColumn } = require('../../sqlite-utils');
const { DEFAULT_SETTINGS } = require('../../../config/defaults');

/** The schema as it existed before versioned migrations (safe to run on databases that already have it). */
module.exports = (db) => {
  db.exec(ddl);
  for (const [table, defs] of Object.entries(columns)) for (const [name, decl] of defs) addColumn(db, table, name, decl);

  db.exec("UPDATE tables SET is_parcel = 1 WHERE id GLOB 'P[0-9]*' AND is_parcel = 0");

  const setSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) setSetting.run(key, value);

  // menu items that never got a position get one at the end of their category
  const unpositioned = db.prepare('SELECT id, category_id FROM menu_items WHERE sort_order = 0 ORDER BY category_id, id').all();
  if (unpositioned.length) {
    const maxima = Object.fromEntries(
      db.prepare('SELECT category_id, MAX(sort_order) AS m FROM menu_items GROUP BY category_id').all().map(r => [r.category_id, r.m || 0])
    );
    const update = db.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?');
    for (const item of unpositioned) {
      maxima[item.category_id] = (maxima[item.category_id] || 0) + 1;
      update.run(maxima[item.category_id], item.id);
    }
  }
};
