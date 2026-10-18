'use strict';
const db = require('../../db/tenant');

const forOrder = (orderId) => db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
const find = (orderId, menuItemId, note) =>
  db.prepare('SELECT id FROM order_items WHERE order_id = ? AND menu_item_id = ? AND note = ?').get(orderId, menuItemId, note);
const byIdInOrder = (id, orderId) => db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(id, orderId);
const addQuantity = (id, qty) => db.prepare('UPDATE order_items SET quantity = quantity + ? WHERE id = ?').run(qty, id);
const insert = (orderId, it) =>
  db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(orderId, it.menu_item_id, it.name, it.price, it.quantity, it.note || '');
const remove = (id) => db.prepare('DELETE FROM order_items WHERE id = ?').run(id);
const removeForOrder = (orderId) => db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
const countForOrder = (orderId) => db.prepare('SELECT COUNT(*) AS c FROM order_items WHERE order_id = ?').get(orderId).c;
const removeAll = () => db.prepare('DELETE FROM order_items').run();

/** Items of many orders in ONE query, grouped by order id (replaces per-order lookups). */
function forOrders(orderIds) {
  const grouped = new Map(orderIds.map(id => [id, []]));
  if (!orderIds.length) return grouped;
  const rows = db.prepare('SELECT * FROM order_items WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY id')
    .all(JSON.stringify(orderIds));
  for (const r of rows) grouped.get(r.order_id).push(r);
  return grouped;
}

/** Sets `.items` on every order in the list (mutates and returns it). */
function attachTo(orders) {
  const grouped = forOrders(orders.map(o => o.id));
  for (const o of orders) o.items = grouped.get(o.id) || [];
  return orders;
}

const totalQuantity = (orderIds) => !orderIds.length ? 0 : (db.prepare(
  'SELECT SUM(quantity) AS q FROM order_items WHERE order_id IN (SELECT value FROM json_each(?))').get(JSON.stringify(orderIds)).q || 0);

module.exports = {
  forOrder, find, byIdInOrder, addQuantity, insert, remove, removeForOrder, countForOrder, removeAll,
  forOrders, attachTo, totalQuantity,
};
