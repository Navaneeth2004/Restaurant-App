'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db/database');

// ── Migration: add payment + customer + session columns if missing ─────────
(function migrate() {
  try { db.exec(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN payment_details TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN change_amount REAL DEFAULT 0`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN customer_phone TEXT DEFAULT NULL`); } catch (_) {}
  // session_id groups all rounds from the same customer visit at a table.
  try { db.exec(`ALTER TABLE orders ADD COLUMN session_id TEXT DEFAULT NULL`); } catch (_) {}
})();

// ── In-memory guards ──────────────────────────────────────────────────────
const _pendingTables = new Set();
const _closingOrders = new Set();

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

router.get('/active', (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'active' ORDER BY created_at ASC").all();
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// Returns only the rounds belonging to the current customer session at this table.
router.get('/table/:tableId/all', (req, res) => {
  const latest = db.prepare(
    "SELECT session_id FROM orders WHERE table_id = ? AND status IN ('active','delivered') ORDER BY created_at DESC LIMIT 1"
  ).get(req.params.tableId);

  if (!latest || !latest.session_id) return res.json([]);

  const orders = db.prepare(
    "SELECT * FROM orders WHERE table_id = ? AND session_id = ? ORDER BY created_at ASC"
  ).all(req.params.tableId, latest.session_id);

  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// Returns the most relevant current order for a table.
// Prefers an active order (new round being built) over a delivered one.
router.get('/table/:tableId', (req, res) => {
  // First check if there's an active round (takes priority — customer is adding more)
  let order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(req.params.tableId);
  // Fall back to most recently delivered (waiting for bill)
  if (!order) order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'delivered' ORDER BY delivered_at DESC LIMIT 1").get(req.params.tableId);
  if (!order) return res.json(null);
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json(order);
});

// BUG FIX: History must only show 'closed' orders (fully billed).
// Previously it included 'delivered' which caused unbilled orders to appear in history.
router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'closed' ORDER BY created_at DESC LIMIT ?").all(limit);
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

router.get('/:id', (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

router.post('/', (req, res) => {
  const { table_id, items } = req.body;
  if (!table_id || !items || !items.length) return res.status(400).json({ error: 'table_id and items required' });

  if (_pendingTables.has(table_id)) return res.status(409).json({ error: 'Order already being processed. Please wait.' });
  _pendingTables.add(table_id);

  try {
    let order, isNew, newItems = [];

    const saveOrder = db.transaction(() => {
      // BUG FIX: Also check for 'delivered' orders when looking for an existing session.
      // Previously only 'active' was checked, so adding items after Round 1 was delivered
      // would create a new order row (Round 2) with a NEW session_id — breaking the rounds
      // grouping and causing the kitchen view to miss it.
      // Now: if an active order exists, update it as before.
      //      If only a delivered order exists (same session), create a new round linked to
      //      that session_id so all rounds stay grouped under the same bill.
      const existingActive = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(table_id);
      const existingDelivered = !existingActive
        ? db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'delivered' ORDER BY created_at DESC LIMIT 1").get(table_id)
        : null;
      const existing = existingActive || null;

      if (existing) {
        // Update the existing active round
        const prevItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(existing.id);
        const prevMap = {};
        for (const pi of prevItems) {
          const key = `${pi.menu_item_id}|${pi.note || ''}`;
          prevMap[key] = (prevMap[key] || 0) + pi.quantity;
        }
        for (const item of items) {
          const key = `${item.menu_item_id}|${item.note || ''}`;
          const added = item.quantity - (prevMap[key] || 0);
          if (added > 0) newItems.push({ ...item, quantity: added });
        }
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(existing.id);
        const ins = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');
        for (const it of items) ins.run(existing.id, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), it.note || '');
        recalcTotal(existing.id);
        isNew = false;
        return getOrderWithItems(existing.id);
      } else {
        // Create a new order row.
        // If a delivered order exists for this table, inherit its session_id so this new
        // round is grouped with the previous rounds on the same bill.
        // If no previous order exists at all, generate a fresh session_id (new customer).
        const orderId   = uuidv4();
        const sessionId = existingDelivered ? existingDelivered.session_id : uuidv4();
        const now = new Date().toISOString();
        db.prepare('INSERT INTO orders (id, table_id, session_id, status, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(orderId, table_id, sessionId, 'active', now);
        db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table_id);
        const ins = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');
        for (const it of items) ins.run(orderId, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), it.note || '');
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
        req.io.emit('order_additions', { orderId: order.id, tableId: order.table_id, additions: newItems, createdAt: new Date().toISOString() });
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

// ── PATCH cancel a single item from an active or delivered order ──────────
router.patch('/:id/cancel-item', (req, res) => {
  const { item_id } = req.body;
  if (!item_id) return res.status(400).json({ error: 'item_id required' });

  try {
    const cancel = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) return null;
      if (order.status === 'closed') return { error: 'Order already closed' };

      const item = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(item_id, req.params.id);
      if (!item) return { error: 'Item not found' };

      const cancelledItem = { ...item };

      db.prepare('DELETE FROM order_items WHERE id = ?').run(item_id);
      recalcTotal(req.params.id);

      const remaining = db.prepare('SELECT COUNT(*) as c FROM order_items WHERE order_id = ?').get(req.params.id).c;
      if (remaining === 0) {
        // Delete the order entirely — it was never billed so it must not appear in reports history.
        // Setting status='closed' with total=0 would create ghost ₹0.00 entries in the reports view.
        db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
        // Check within the same session only
        const other = db.prepare(
          "SELECT COUNT(*) as c FROM orders WHERE table_id = ? AND session_id = ? AND status IN ('active','delivered') AND id != ?"
        ).get(order.table_id, order.session_id, req.params.id).c;
        if (other === 0) db.prepare("UPDATE tables SET status = 'empty' WHERE id = ?").run(order.table_id);
        return { cancelled: true, order_cancelled: true, table_id: order.table_id, cancelledItem, orderStatus: order.status };
      }

      return { updatedOrder: getOrderWithItems(req.params.id), cancelledItem, orderStatus: order.status };
    });

    const result = cancel();
    if (!result) return res.status(404).json({ error: 'Order not found' });
    if (result.error) return res.status(400).json({ error: result.error });

    if (result.order_cancelled) {
      req.io.emit('order_item_cancelled', {
        orderId: req.params.id,
        tableId: result.table_id,
        cancelledItem: result.cancelledItem,
        orderStatus: result.orderStatus,
        updatedOrder: { id: req.params.id, table_id: result.table_id, items: [] },
      });
      req.io.emit('order_closed', { orderId: req.params.id, tableId: result.table_id });
      req.io.emit('tables_updated');
    } else {
      req.io.emit('order_updated', { order: result.updatedOrder, isNew: false });
      req.io.emit('order_item_cancelled', {
        orderId: req.params.id,
        tableId: result.updatedOrder.table_id,
        cancelledItem: result.cancelledItem,
        orderStatus: result.orderStatus,
        updatedOrder: result.updatedOrder,
      });
    }
    res.json(result.updatedOrder || { success: true });
  } catch (err) {
    console.error('[Orders] Cancel item error:', err.message);
    res.status(500).json({ error: 'Failed to cancel item' });
  }
});

// ── PATCH cancel entire order (before billing) ────────────────────────────
router.patch('/:id/cancel', (req, res) => {
  try {
    const cancel = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) return null;
      if (order.status === 'closed') return { error: 'Order already closed' };

      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
      db.prepare("UPDATE orders SET status = 'closed' WHERE id = ?").run(req.params.id);

      // Only free the table if no other orders in this session remain active/delivered
      const other = db.prepare(
        "SELECT COUNT(*) as c FROM orders WHERE table_id = ? AND session_id = ? AND status IN ('active','delivered') AND id != ?"
      ).get(order.table_id, order.session_id, req.params.id).c;
      if (other === 0) db.prepare("UPDATE tables SET status = 'empty' WHERE id = ?").run(order.table_id);
      return { success: true, table_id: order.table_id, tableId: order.table_id, items, orderStatus: order.status };
    });

    const result = cancel();
    if (!result) return res.status(404).json({ error: 'Order not found' });
    if (result.error) return res.status(400).json({ error: result.error });

    req.io.emit('order_closed', { orderId: req.params.id, tableId: result.table_id });
    req.io.emit('tables_updated');
    req.io.emit('order_round_cancelled', {
      orderId: req.params.id,
      tableId: result.tableId,
      cancelledItems: result.items,
      orderStatus: result.orderStatus,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

router.patch('/:id/deliver', (req, res) => {
  try {
    const deliver = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) return null;
      if (order.status === 'delivered') return getOrderWithItems(req.params.id);
      if (order.status !== 'active') return null;
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
    res.status(500).json({ error: 'Failed to mark delivered' });
  }
});

// ── PATCH close order with payment details ─────────────────────────────────
router.patch('/:id/close', (req, res) => {
  const orderId = req.params.id;

  const orderRow = db.prepare('SELECT table_id FROM orders WHERE id = ?').get(orderId);
  if (!orderRow) return res.status(404).json({ error: 'Order not found' });

  const lockKey = `table:${orderRow.table_id}`;

  if (_closingOrders.has(lockKey)) {
    return res.status(409).json({ error: 'This table is already being closed. Please wait.' });
  }
  _closingOrders.add(lockKey);

  const { payment_method, payment_details, change_amount, customer_name, customer_phone } = req.body || {};

  try {
    try { db.exec(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN payment_details TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN change_amount REAL DEFAULT 0`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN customer_phone TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN session_id TEXT DEFAULT NULL`); } catch (_) {}

    const close = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order) return { notFound: true };

      if (order.status === 'closed') {
        return { alreadyClosed: true, table_id: order.table_id };
      }

      const payMethod  = payment_method  || 'cash';
      const payDetails = payment_details ? JSON.stringify(payment_details) : null;
      const change     = typeof change_amount === 'number' ? change_amount : 0;
      const custName   = customer_name  || null;
      const custPhone  = customer_phone || null;

      // Close only the orders belonging to this customer's session_id.
      // This prevents accidentally closing a new customer's order at the same table.
      db.prepare(`
        UPDATE orders
        SET status = 'closed',
            payment_method  = ?,
            payment_details = ?,
            change_amount   = ?,
            customer_name   = ?,
            customer_phone  = ?
        WHERE table_id = ?
          AND session_id = ?
          AND status IN ('active','delivered')
      `).run(payMethod, payDetails, change, custName, custPhone, order.table_id, order.session_id);

      db.prepare("UPDATE tables SET status = 'empty' WHERE id = ?").run(order.table_id);
      return { table_id: order.table_id };
    });

    const result = close();

    if (result.notFound) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const finalOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    req.io.emit('order_closed', { orderId, tableId: finalOrder?.table_id });
    req.io.emit('tables_updated');

    if (result.alreadyClosed) {
      return res.json({ success: true, note: 'Order was already closed by another device.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Orders] Close error:', err.message, err.stack);
    res.status(500).json({ error: `Failed to close order: ${err.message}` });
  } finally {
    _closingOrders.delete(lockKey);
  }
});

// ── PATCH update payment on already-closed orders (for history editing) ───
router.patch('/:id/payment', (req, res) => {
  const { payment_method, payment_details, change_amount, customer_name, customer_phone } = req.body || {};
  if (!payment_method) return res.status(400).json({ error: 'payment_method required' });

  try {
    try { db.exec(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN payment_details TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN change_amount REAL DEFAULT 0`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN customer_phone TEXT DEFAULT NULL`); } catch (_) {}

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const payDetails = payment_details ? JSON.stringify(payment_details) : null;
    const change     = typeof change_amount === 'number' ? change_amount : 0;

    db.prepare(`
      UPDATE orders
      SET payment_method = ?, payment_details = ?, change_amount = ?,
          customer_name = COALESCE(?, customer_name),
          customer_phone = COALESCE(?, customer_phone)
      WHERE id = ?
    `).run(payment_method, payDetails, change,
           customer_name || null, customer_phone || null,
           req.params.id);

    res.json({ success: true });
  } catch (err) {
    console.error('[Orders] Payment update error:', err.message);
    res.status(500).json({ error: `Failed to update payment: ${err.message}` });
  }
});

module.exports = router;