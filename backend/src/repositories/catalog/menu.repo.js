'use strict';
const db = require('../../db/tenant');

const WITH_CATEGORY = `
  SELECT m.*, c.name AS category_name
  FROM menu_items m JOIN categories c ON m.category_id = c.id`;

const list = () => db.prepare(`${WITH_CATEGORY} ORDER BY c.sort_order, m.sort_order, m.id`).all();
const listAvailable = () => db.prepare(`${WITH_CATEGORY} WHERE m.available = 1 ORDER BY c.sort_order, m.sort_order, m.id`).all();
const byCategory = (catId) => db.prepare(`${WITH_CATEGORY} WHERE m.category_id = ? ORDER BY m.sort_order, m.id`).all(catId);
const withCategory = (id) => db.prepare(`${WITH_CATEGORY} WHERE m.id = ?`).get(id);
const rawById = (id) => db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
const maxSort = (catId) => db.prepare('SELECT MAX(sort_order) AS m FROM menu_items WHERE category_id = ?').get(catId).m || 0;
const existsByName = (name, catId) =>
  !!db.prepare('SELECT id FROM menu_items WHERE LOWER(name) = LOWER(?) AND category_id = ?').get(name, catId);

const insert = ({ name, description, price, categoryId, imagePath, sortOrder, available = 1 }) =>
  db.prepare('INSERT INTO menu_items (name, description, price, category_id, image_path, available, sort_order) VALUES (?,?,?,?,?,?,?)')
    .run(name, description, price, categoryId, imagePath, available, sortOrder).lastInsertRowid;

const update = (id, f) => db.prepare(`
  UPDATE menu_items SET
    name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price),
    category_id = COALESCE(?, category_id), image_path = ?, available = COALESCE(?, available)
  WHERE id = ?`).run(f.name, f.description, f.price, f.categoryId, f.imagePath, f.available, id);

const reorder = (rows) => {
  const stmt = db.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?');
  db.transaction(() => { for (const { id, sort_order } of rows) stmt.run(sort_order, id); })();
};
const remove = (id) => db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
const inOpenOrder = (id) => !!db.prepare(`
  SELECT oi.id FROM order_items oi JOIN orders o ON oi.order_id = o.id
  WHERE oi.menu_item_id = ? AND o.status IN ('active', 'delivered') LIMIT 1`).get(id);
const imagePaths = () => db.prepare("SELECT id, image_path FROM menu_items WHERE image_path IS NOT NULL AND image_path != ''").all();
const setImage = (id, path) => db.prepare('UPDATE menu_items SET image_path = ? WHERE id = ?').run(path, id);
const deleteAll = () => db.prepare('DELETE FROM menu_items').run();

module.exports = {
  list, listAvailable, byCategory, withCategory, rawById, maxSort, existsByName, insert, update, reorder,
  remove, inOpenOrder, imagePaths, setImage, deleteAll,
};
