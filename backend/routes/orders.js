const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db/database');

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

// GET all active orders (kitchen)
router.get('/active', (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'active' ORDER BY created_at ASC").all();
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// GET order for a specific table
router.get('/table/:tableId', (req, res) => {
  let order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(req.params.tableId);
  if (!order) {
    order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'delivered' ORDER BY delivered_at DESC LIMIT 1").get(req.params.tableId);
  }
  if (!order) return res.json(null);
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json(order);
});

// GET order history
router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const orders = db.prepare("SELECT * FROM orders WHERE status IN ('delivered','closed') ORDER BY created_at DESC LIMIT ?").all(limit);
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// GET single order
router.get('/:id', (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

// POST create or update order
router.post('/', (req, res) => {
  const { table_id, items } = req.body;
  if (!table_id || !items || !items.length) return res.status(400).json({ error: 'table_id and items required' });

  // Only merge with ACTIVE orders — never modify delivered orders
  const existing = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(table_id);

  // FIX 2: compute which items are truly NEW (added this submission)
  // The frontend sends the full merged list; we compare against what's already in DB
  // to find the delta so kitchen only sees additions.
  let newItems = items; // default: all items are new (new order)

  if (existing) {
    const prevItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(existing.id);

    // Build a map of existing items: "menu_item_id|note" -> quantity
    const prevMap = {};
    for (const pi of prevItems) {
      const key = `${pi.menu_item_id}|${pi.note || ''}`;
      prevMap[key] = (prevMap[key] || 0) + pi.quantity;
    }

    // Find genuinely new/increased items
    newItems = [];
    for (const item of items) {
      const key = `${item.menu_item_id}|${item.note || ''}`;
      const prevQty = prevMap[key] || 0;
      const addedQty = item.quantity - prevQty;
      if (addedQty > 0) {
        newItems.push({ ...item, quantity: addedQty });
      }
    }
  }

  const saveOrder = db.transaction(() => {
    let orderId;
    if (existing) {
      orderId = existing.id;
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    } else {
      orderId = uuidv4();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO orders (id, table_id, status, created_at) VALUES (?, ?, ?, ?)').run(orderId, table_id, 'active', now);
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

  if (isNew) {
    // Brand new order — kitchen sees full order
    req.io.emit('new_order', { order });
    req.io.emit('order_updated', { order, isNew: true });
  } else {
    // Update to existing order — emit full order for billing,
    // but also emit a separate event with ONLY the new additions for kitchen display
    req.io.emit('order_updated', { order, isNew: false });
    if (newItems.length > 0) {
      // Kitchen gets a separate "order_additions" event with only the delta
      req.io.emit('order_additions', {
        orderId: order.id,
        tableId: order.table_id,
        additions: newItems,
        createdAt: new Date().toISOString(),
      });
    }
  }

  res.status(isNew ? 201 : 200).json(order);
});

// PATCH mark delivered
router.patch('/:id/deliver', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const now = new Date().toISOString();
  db.prepare("UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ?").run(now, req.params.id);
  db.prepare("UPDATE tables SET status = 'waiting_bill' WHERE id = ?").run(order.table_id);
  const updated = getOrderWithItems(req.params.id);
  req.io.emit('order_delivered', { order: updated });
  req.io.emit('tables_updated');
  res.json(updated);
});

// PATCH close order (bill paid) — table goes empty
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
