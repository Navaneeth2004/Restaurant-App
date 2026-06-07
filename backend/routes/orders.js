const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db/database');

// ── In-flight lock: prevents two simultaneous submits for the same table ──
// sql.js is synchronous so JS's single-threaded event loop normally prevents
// true races, BUT async gaps (await in route handlers) can allow two requests
// to both read "no existing order" before either has written. This set closes
// that window.
const _pendingTables = new Set();

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

// GET ALL non-closed orders for a table (used for billing across multiple rounds)
router.get('/table/:tableId/all', (req, res) => {
  const orders = db.prepare(
    "SELECT * FROM orders WHERE table_id = ? AND status IN ('active','delivered') ORDER BY created_at ASC"
  ).all(req.params.tableId);
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// GET most recent active or delivered order for a specific table
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
// CONCURRENCY FIX: wrapped entirely in a db.transaction so two simultaneous
// submissions for the same table cannot both see "no existing order" and
// both create a new order. The _pendingTables set adds a second layer of
// protection against the async gap before the transaction starts.
router.post('/', (req, res) => {
  const { table_id, items } = req.body;
  if (!table_id || !items || !items.length) {
    return res.status(400).json({ error: 'table_id and items required' });
  }

  // Soft lock — reject if this table already has a submit in flight
  if (_pendingTables.has(table_id)) {
    return res.status(409).json({ error: 'Order for this table is already being processed. Please wait a moment.' });
  }
  _pendingTables.add(table_id);

  try {
    let order;
    let isNew;
    let newItems = [];

    // Everything inside one atomic transaction — no async gap possible here
    const saveOrder = db.transaction(() => {
      const existing = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(table_id);

      if (existing) {
        // Existing active order — compute which items are genuinely new additions
        const prevItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(existing.id);
        const prevMap = {};
        for (const pi of prevItems) {
          const key = `${pi.menu_item_id}|${pi.note || ''}`;
          prevMap[key] = (prevMap[key] || 0) + pi.quantity;
        }
        for (const item of items) {
          const key = `${item.menu_item_id}|${item.note || ''}`;
          const prevQty = prevMap[key] || 0;
          const addedQty = item.quantity - prevQty;
          if (addedQty > 0) {
            newItems.push({ ...item, quantity: addedQty });
          }
        }

        // Replace all items with the new full set
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(existing.id);
        const insertItem = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');
        for (const it of items) {
          insertItem.run(existing.id, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), it.note || '');
        }
        recalcTotal(existing.id);
        isNew = false;
        return getOrderWithItems(existing.id);

      } else {
        // New order
        const orderId = uuidv4();
        const now = new Date().toISOString();
        db.prepare('INSERT INTO orders (id, table_id, status, created_at) VALUES (?, ?, ?, ?)').run(orderId, table_id, 'active', now);
        db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table_id);
        const insertItem = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');
        for (const it of items) {
          insertItem.run(orderId, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), it.note || '');
        }
        recalcTotal(orderId);
        isNew = true;
        return getOrderWithItems(orderId);
      }
    });

    order = saveOrder();

    if (isNew) {
      req.io.emit('new_order', { order });
      req.io.emit('order_updated', { order, isNew: true });
    } else {
      req.io.emit('order_updated', { order, isNew: false });
      if (newItems.length > 0) {
        req.io.emit('order_additions', {
          orderId: order.id,
          tableId: order.table_id,
          additions: newItems,
          createdAt: new Date().toISOString(),
        });
      }
    }

    res.status(isNew ? 201 : 200).json(order);

  } catch (err) {
    console.error('[Orders] Submit error:', err.message);
    res.status(500).json({ error: 'Failed to save order. Please try again.' });
  } finally {
    _pendingTables.delete(table_id);
  }
});

// PATCH mark delivered
// CONCURRENCY FIX: status check + update in one transaction so two kitchen
// staff clicking simultaneously don't both "deliver" the same order.
router.patch('/:id/deliver', (req, res) => {
  try {
    const deliver = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) return null;
      // Idempotent: if already delivered, just return the current state
      if (order.status === 'delivered') return getOrderWithItems(req.params.id);
      if (order.status !== 'active') return null; // closed — ignore

      const now = new Date().toISOString();
      db.prepare("UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ?").run(now, req.params.id);
      db.prepare("UPDATE tables SET status = 'waiting_bill' WHERE id = ?").run(order.table_id);
      return getOrderWithItems(req.params.id);
    });

    const updated = deliver();
    if (!updated) return res.status(404).json({ error: 'Order not found or already closed' });

    req.io.emit('order_delivered', { order: updated });
    req.io.emit('tables_updated');
    res.json(updated);
  } catch (err) {
    console.error('[Orders] Deliver error:', err.message);
    res.status(500).json({ error: 'Failed to mark delivered. Please try again.' });
  }
});

// PATCH close order (bill paid)
// CONCURRENCY FIX: two waiters clicking "Mark Paid" simultaneously is handled
// gracefully — the transaction checks status before updating, so the second
// call is a no-op and returns success (idempotent).
router.patch('/:id/close', (req, res) => {
  try {
    const close = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) return false;

      // Check if there are actually any open orders to close
      const openCount = db.prepare(
        "SELECT COUNT(*) as c FROM orders WHERE table_id = ? AND status IN ('active','delivered')"
      ).get(order.table_id).c;

      // Idempotent — if already all closed, just clear the table and succeed
      db.prepare("UPDATE orders SET status = 'closed' WHERE table_id = ? AND status IN ('active','delivered')").run(order.table_id);
      db.prepare("UPDATE tables SET status = 'empty' WHERE id = ?").run(order.table_id);
      return true;
    });

    const ok = close();
    if (!ok) return res.status(404).json({ error: 'Order not found' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    req.io.emit('order_closed', { orderId: req.params.id, tableId: order?.table_id });
    req.io.emit('tables_updated');
    res.json({ success: true });
  } catch (err) {
    console.error('[Orders] Close error:', err.message);
    res.status(500).json({ error: 'Failed to close order. Please try again.' });
  }
});

module.exports = router;