'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db/database');

// ── Migration: add all columns if missing ─────────────────────────────────
(function migrate() {
  try { db.exec(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN payment_details TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN change_amount REAL DEFAULT 0`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN customer_phone TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN session_id TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN amount_paid REAL DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'`); } catch (_) {}
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

function getTaxPercent() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'tax_percent'").get();
  return parseFloat(row?.value ?? '5') / 100;
}

// ── GET /active ───────────────────────────────────────────────────────────
router.get('/active', (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'active' ORDER BY created_at ASC").all();
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// ── GET /table/:tableId/all ───────────────────────────────────────────────
// Returns ALL rounds for the CURRENT customer session at a table.
//
// FIX: session lookup is now strict — we only look for the current active/
// delivered session. We never fall back to a closed session, which was causing
// old orders from a previous customer to appear when a new customer sat down
// at the same table before the first socket refresh.
router.get('/table/:tableId/all', (req, res) => {
  // Find the session_id for any currently open order at this table
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

// ── GET /table/:tableId ───────────────────────────────────────────────────
router.get('/table/:tableId', (req, res) => {
  let order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(req.params.tableId);
  if (!order) order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'delivered' ORDER BY delivered_at DESC LIMIT 1").get(req.params.tableId);
  if (!order) return res.json(null);
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json(order);
});

// ── GET /history ──────────────────────────────────────────────────────────
router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'closed' ORDER BY created_at DESC LIMIT ?").all(limit);
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// ── GET /:id ──────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

// ── POST / — Send to Kitchen ──────────────────────────────────────────────
// IMPORTANT: This route creates an 'active' order that appears in the kitchen.
// It is SEPARATE from /direct-bill which bypasses the kitchen entirely.
router.post('/', (req, res) => {
  const { table_id, items } = req.body;
  if (!table_id || !items || !items.length) return res.status(400).json({ error: 'table_id and items required' });

  if (_pendingTables.has(table_id)) return res.status(409).json({ error: 'Order already being processed. Please wait.' });
  _pendingTables.add(table_id);

  try {
    let order, isNew, newItems = [];

    const saveOrder = db.transaction(() => {
      // Look for an existing ACTIVE order to update (add items to)
      const existingActive = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(table_id);

      if (existingActive) {
        // Merge new items into the existing active order
        const prevItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(existingActive.id);
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
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(existingActive.id);
        const ins = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');
        for (const it of items) ins.run(existingActive.id, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), it.note || '');
        recalcTotal(existingActive.id);
        isNew = false;
        return getOrderWithItems(existingActive.id);
      }

      // No active order — create a new one.
      // FIX: Determine session_id carefully:
      // - If the table is currently occupied (has delivered rounds), reuse the session_id
      //   so all rounds for the same customer are grouped together.
      // - If the table is empty or was just reset, start a fresh session.
      const tableRow = db.prepare("SELECT status FROM tables WHERE id = ?").get(table_id);
      const tableIsOccupied = tableRow && tableRow.status !== 'empty';

      let sessionId;
      if (tableIsOccupied) {
        // Look for an existing session from delivered rounds (same customer, adding another round)
        const existingSession = db.prepare(
          "SELECT session_id FROM orders WHERE table_id = ? AND status = 'delivered' ORDER BY created_at DESC LIMIT 1"
        ).get(table_id);
        sessionId = existingSession?.session_id ?? uuidv4();
      } else {
        // Table was empty — this is a new customer, always new session
        sessionId = uuidv4();
      }

      const orderId = uuidv4();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO orders (id, table_id, session_id, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(orderId, table_id, sessionId, 'active', now);
      db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table_id);
      const ins = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');
      for (const it of items) ins.run(orderId, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), it.note || '');
      recalcTotal(orderId);
      isNew = true;
      return getOrderWithItems(orderId);
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

// ── POST /direct-bill ─────────────────────────────────────────────────────
// Creates an order in 'delivered' state — BYPASSES the kitchen display.
// Used when a waiter wants to bill immediately without sending to kitchen,
// e.g. for items already consumed that were never sent, or a quick parcel.
//
// FIX: session_id handling now matches the POST / route:
//   - If the table already has active/delivered orders (same customer session),
//     reuse their session_id so the bill groups correctly.
//   - If the table was empty (new or just cleared), create a new session.
//
// FIX: delivered_at is set to the SAME value as created_at so OrderContent
//   can detect this as a direct-bill order (diff < 2 seconds) and not show
//   it as a "Round — Delivered" kitchen round.
//
// FIX: After direct-bill, the table becomes 'waiting_bill', not 'occupied'.
//   This is intentional — the waiter is ready to collect payment.
//   It does NOT prevent adding further rounds via Send to Kitchen; that route
//   will change the table back to 'occupied' when the next active order arrives.
router.post('/direct-bill', (req, res) => {
  const { table_id, items } = req.body;
  if (!table_id || !items || !items.length) return res.status(400).json({ error: 'table_id and items required' });

  if (_pendingTables.has(table_id)) return res.status(409).json({ error: 'Order already being processed. Please wait.' });
  _pendingTables.add(table_id);

  try {
    const order = db.transaction(() => {
      const tableRow = db.prepare("SELECT status FROM tables WHERE id = ?").get(table_id);
      const tableIsOccupied = tableRow && tableRow.status !== 'empty';

      let sessionId;
      if (tableIsOccupied) {
        // Reuse existing session (same customer, multiple rounds including kitchen rounds)
        const existingSession = db.prepare(
          "SELECT session_id FROM orders WHERE table_id = ? AND status IN ('active','delivered') ORDER BY created_at DESC LIMIT 1"
        ).get(table_id);
        sessionId = existingSession?.session_id ?? uuidv4();
      } else {
        // New customer — fresh session
        sessionId = uuidv4();
      }

      const orderId = uuidv4();
      const now     = new Date().toISOString();

      // delivered_at = created_at marks this as a direct-bill order (no kitchen delay)
      db.prepare('INSERT INTO orders (id, table_id, session_id, status, created_at, delivered_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(orderId, table_id, sessionId, 'delivered', now, now);

      // Set table to waiting_bill so the waiter knows to collect payment
      db.prepare("UPDATE tables SET status = 'waiting_bill' WHERE id = ?").run(table_id);

      const ins = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');
      for (const it of items) ins.run(orderId, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), it.note || '');
      recalcTotal(orderId);

      return getOrderWithItems(orderId);
    })();

    // Do NOT emit new_order — this bypasses the kitchen display intentionally
    req.io.emit('tables_updated');
    res.status(201).json(order);
  } catch (err) {
    console.error('[Orders] Direct-bill error:', err.message);
    res.status(500).json({ error: 'Failed to create direct-bill order.' });
  } finally {
    _pendingTables.delete(table_id);
  }
});

// ── PATCH /:id/cancel-item ────────────────────────────────────────────────
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
        db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
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

// ── PATCH /:id/cancel ─────────────────────────────────────────────────────
router.patch('/:id/cancel', (req, res) => {
  try {
    const cancel = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) return null;
      if (order.status === 'closed') return { error: 'Order already closed' };

      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);

      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
      db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);

      const other = db.prepare(
        "SELECT COUNT(*) as c FROM orders WHERE table_id = ? AND session_id = ? AND status IN ('active','delivered')"
      ).get(order.table_id, order.session_id).c;
      if (other === 0) db.prepare("UPDATE tables SET status = 'empty' WHERE id = ?").run(order.table_id);

      return {
        success: true,
        table_id: order.table_id,
        tableId: order.table_id,
        items,
        orderStatus: order.status,
      };
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

// ── PATCH /:id/deliver ────────────────────────────────────────────────────
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

// ── PATCH /:id/close ──────────────────────────────────────────────────────
// FIX: Closes ALL orders in the session (active + delivered + direct-bill).
// Previously only the specific orderId's session was closed, but this is
// already handled by the WHERE session_id = ? clause. The real fix is that
// we now correctly compute billTotal from ALL session orders so amount_paid
// is consistent even when there are mixed kitchen + direct-bill rounds.
//
// FIX: After closing, always reset table to 'empty' regardless of the
// previous status (waiting_bill, occupied, etc.).
router.patch('/:id/close', (req, res) => {
  const orderId = req.params.id;

  const orderRow = db.prepare('SELECT table_id, session_id FROM orders WHERE id = ?').get(orderId);
  if (!orderRow) return res.status(404).json({ error: 'Order not found' });

  const lockKey = `table:${orderRow.table_id}`;

  if (_closingOrders.has(lockKey)) {
    return res.status(409).json({ error: 'This table is already being closed. Please wait.' });
  }
  _closingOrders.add(lockKey);

  const { payment_method, payment_details, change_amount, customer_name, customer_phone, amount_paid, order_type } = req.body || {};

  try {
    const close = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order) return { notFound: true };

      // Check if ALL orders in this session are already closed
      const openCount = db.prepare(
        "SELECT COUNT(*) as c FROM orders WHERE table_id = ? AND session_id = ? AND status IN ('active','delivered')"
      ).get(order.table_id, order.session_id).c;

      if (openCount === 0) {
        return { alreadyClosed: true, table_id: order.table_id };
      }

      const payMethod  = payment_method  || 'cash';
      const payDetails = payment_details ? JSON.stringify(payment_details) : null;
      const change     = typeof change_amount === 'number' ? change_amount : 0;
      const custName   = customer_name  || null;
      const custPhone  = customer_phone || null;
      const orderType  = (order_type === 'parcel') ? 'parcel' : 'dine_in';

      const taxPct = getTaxPercent();

      // Compute the bill total from ALL orders in the session (kitchen + direct-bill)
      const allSessionOrders = db.prepare(
        "SELECT total FROM orders WHERE table_id = ? AND session_id = ? AND status IN ('active','delivered')"
      ).all(order.table_id, order.session_id);
      const sessionSubtotal = allSessionOrders.reduce((s, r) => s + (r.total || 0), 0);
      const billTotal = sessionSubtotal * (1 + taxPct);

      const paidAmount = typeof amount_paid === 'number' && !Number.isNaN(amount_paid)
        ? amount_paid
        : billTotal;

      // Close ALL open orders in this session atomically
      db.prepare(`
        UPDATE orders
        SET status = 'closed',
            payment_method  = ?,
            payment_details = ?,
            change_amount   = ?,
            customer_name   = ?,
            customer_phone  = ?,
            amount_paid     = ?,
            order_type      = ?
        WHERE table_id = ?
          AND session_id = ?
          AND status IN ('active','delivered')
      `).run(payMethod, payDetails, change, custName, custPhone, paidAmount, orderType, order.table_id, order.session_id);

      // Always free the table after successful payment
      db.prepare("UPDATE tables SET status = 'empty' WHERE id = ?").run(order.table_id);

      return { table_id: order.table_id };
    });

    const result = close();

    if (result.notFound) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (result.alreadyClosed) {
      return res.json({ success: true, note: 'Order was already closed by another device.' });
    }

    req.io.emit('order_closed', { orderId, tableId: result.table_id });
    req.io.emit('tables_updated');

    res.json({ success: true });
  } catch (err) {
    console.error('[Orders] Close error:', err.message, err.stack);
    res.status(500).json({ error: `Failed to close order: ${err.message}` });
  } finally {
    _closingOrders.delete(lockKey);
  }
});

// ── PATCH /:id/payment ────────────────────────────────────────────────────
router.patch('/:id/payment', (req, res) => {
  const { payment_method, payment_details, change_amount, customer_name, customer_phone, amount_paid, order_type } = req.body || {};
  if (!payment_method) return res.status(400).json({ error: 'payment_method required' });

  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const payDetails = payment_details ? JSON.stringify(payment_details) : null;
    const change     = typeof change_amount === 'number' ? change_amount : 0;
    const paidAmount = typeof amount_paid === 'number' && !Number.isNaN(amount_paid) ? amount_paid : null;
    const orderType  = order_type === 'parcel' || order_type === 'dine_in' ? order_type : null;

    db.prepare(`
      UPDATE orders
      SET payment_method = ?, payment_details = ?, change_amount = ?,
          customer_name = COALESCE(?, customer_name),
          customer_phone = COALESCE(?, customer_phone),
          amount_paid = COALESCE(?, amount_paid),
          order_type = COALESCE(?, order_type)
      WHERE id = ?
    `).run(payment_method, payDetails, change,
           customer_name || null, customer_phone || null,
           paidAmount, orderType,
           req.params.id);

    res.json({ success: true });
  } catch (err) {
    console.error('[Orders] Payment update error:', err.message);
    res.status(500).json({ error: `Failed to update payment: ${err.message}` });
  }
});

module.exports = router;
