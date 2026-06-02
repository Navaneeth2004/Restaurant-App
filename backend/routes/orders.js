const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

function getOrderWithItems(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  return order;
}

function recalcTotal(orderId) {
  const items = db.prepare('SELECT price, quantity FROM order_items WHERE order_id = ?').all(orderId);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  db.prepare('UPDATE orders SET total = ? WHERE id = ?').run(total, orderId);
  return total;
}

// GET all active orders (for kitchen)
router.get('/active', (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'active' ORDER BY created_at ASC").all();
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// GET orders for a specific table
router.get('/table/:tableId', (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(req.params.tableId);
  if (!order) return res.json(null);
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json(order);
});

// GET order history (delivered/closed)
router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const orders = db.prepare("SELECT * FROM orders WHERE status != 'active' ORDER BY created_at DESC LIMIT ?").all(limit);
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// GET single order
router.get('/:id', (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

// POST create or update order for a table
router.post('/', (req, res) => {
  const { table_id, items } = req.body;
  if (!table_id || !items || !items.length) return res.status(400).json({ error: 'table_id and items required' });

  const existing = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(table_id);

  const saveOrder = db.transaction(() => {
    let orderId;
    if (existing) {
      orderId = existing.id;
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    } else {
      orderId = uuidv4();
      db.prepare('INSERT INTO orders (id, table_id, status) VALUES (?, ?, ?)').run(orderId, table_id, 'active');
      db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table_id);
    }

    const insertItem = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');
    for (const it of items) {
      insertItem.run(orderId, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), it.note || '');
    }

    recalcTotal(orderId);
    return getOrderWithItems(orderId);
  });

  const order = saveOrder();
  const isNew = !existing;
  req.io.emit('order_updated', { order, isNew });
  if (isNew) req.io.emit('new_order', { order });
  res.status(isNew ? 201 : 200).json(order);
});

// PATCH mark delivered
router.patch('/:id/deliver', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE orders SET status = 'delivered', delivered_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").run(req.params.id);
  db.prepare("UPDATE tables SET status = 'waiting_bill' WHERE id = ?").run(order.table_id);
  const updated = getOrderWithItems(req.params.id);
  req.io.emit('order_delivered', { order: updated });
  req.io.emit('tables_updated');
  res.json(updated);
});

// PATCH close order (after bill paid)
router.patch('/:id/close', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE orders SET status = 'closed' WHERE id = ?").run(req.params.id);
  db.prepare("UPDATE tables SET status = 'empty' WHERE id = ?").run(order.table_id);
  req.io.emit('order_closed', { orderId: req.params.id, tableId: order.table_id });
  req.io.emit('tables_updated');
  res.json({ success: true });
});

module.exports = router;
