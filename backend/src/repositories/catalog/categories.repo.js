'use strict';
const db = require('../../db/tenant');

const list = () => db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
const byId = (id) => db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
const byName = (name) => db.prepare('SELECT * FROM categories WHERE LOWER(name) = LOWER(?)').get(name);
const maxSort = () => db.prepare('SELECT MAX(sort_order) AS m FROM categories').get().m || 0;
const insert = (name, sortOrder) => db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, sortOrder).lastInsertRowid;
const update = (id, name, sortOrder) =>
  db.prepare('UPDATE categories SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order) WHERE id = ?').run(name, sortOrder, id);
const reorder = (rows) => {
  const stmt = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
  db.transaction(() => rows.forEach(({ id, sort_order }) => stmt.run(sort_order, id)))();
};
const remove = (id) => db.prepare('DELETE FROM categories WHERE id = ?').run(id);
const itemCount = (id) => db.prepare('SELECT COUNT(*) AS c FROM menu_items WHERE category_id = ?').get(id).c;
const itemsInOpenOrders = (id) => db.prepare(`
  SELECT COUNT(*) AS c FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  JOIN menu_items m ON oi.menu_item_id = m.id
  WHERE m.category_id = ? AND o.status IN ('active', 'delivered')`).get(id).c;
const deleteAll = () => db.prepare('DELETE FROM categories').run();

module.exports = { list, byId, byName, maxSort, insert, update, reorder, remove, itemCount, itemsInOpenOrders, deleteAll };
