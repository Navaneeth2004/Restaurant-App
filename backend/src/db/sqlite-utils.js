'use strict';
/** Schema helpers shared by the central and tenant migrations. */
const columnNames = (db, table) => new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(r => r.name));
const hasColumn = (db, table, column) => columnNames(db, table).has(column);

/** ALTER TABLE ... ADD COLUMN, but only when the column is missing. */
function addColumn(db, table, column, declaration) {
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${declaration}`);
}

/** Run a numbered list of migrations once each, tracked in PRAGMA user_version. */
function runMigrations(db, migrations) {
  const current = db.pragma('user_version', { simple: true });
  for (let i = current; i < migrations.length; i++) {
    db.transaction(() => { migrations[i](db); db.pragma(`user_version = ${i + 1}`); })();
  }
}

module.exports = { hasColumn, addColumn, runMigrations };
