'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db/database');

(function migrate() {
  try { db.exec(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN payment_details TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN change_amount REAL DEFAULT 0`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN customer_phone TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN session_id TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN amount_paid REAL DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN customer_gstin TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN tax_percent_snapshot REAL DEFAULT NULL`); } catch (_) {}
})();

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

function isDirectBillOrder(order) {
  if (!order.delivered_at || !order.created_at) return false;
  const diff = Math.abs(new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime());
  return diff < 2000;
}

router.get('/active', (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'active' ORDER BY created_at ASC").all();
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

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

router.get('/table/:tableId', (req, res) => {
  let order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(req.params.tableId);
  if (!order) order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'delivered' ORDER BY delivered_at DESC LIMIT 1").get(req.params.tableId);
  if (!order) return res.json(null);
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json(order);
});

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

// ── POST / — Send to Kitchen ──────────────────────────────────────────────
// FIX (concurrency data-loss bug, confirmed via live two-device test):
// this route used to trust `items` as a COMPLETE, already-merged snapshot
// of the entire order — it deleted every existing order_item row and
// re-inserted exactly what the request body contained. WaiterView.tsx used
// to construct that snapshot client-side (fetch fresh active order, merge
// with its own cart, send the combined list). The problem: if two devices
// both add items to the same table within the same short window, each
// computes its own "complete" snapshot from a state that doesn't yet
// include the other device's addition — whichever request runs second
// silently overwrites the first device's items with no error at all. This
// is NOT a low-level race (the _pendingTables lock below already
// serializes requests to the same table one at a time) — it happens even
// when the two requests run strictly sequentially, because each one's
// payload was simply incomplete relative to the other.
//
// Verified with a live test: two concurrent POSTs, one with 2x Crispy
// Wings, one with 3x Loaded Fries — before this fix, only the second
// request's items survived (wings silently vanished). After this fix,
// both items are present, and a 5-way concurrent test adding the same
// item 5 times independently produced the correct combined quantity of 5.
//
// Fix: `items` is now a pure ADDITIVE contribution — the caller sends
// ONLY its own new/unsent items, never a reconstructed full list (see the
// simplified WaiterView.tsx/KioskView.tsx, which no longer pre-fetch and
// merge). For each incoming item, if a row for the same
// (menu_item_id, note) already exists on the active order, its quantity
// is incremented; otherwise a new row is inserted. Existing rows are
// NEVER deleted here — removal only ever happens through the explicit
// cancel-item/cancel endpoints. This makes the operation commutative: no
// matter what order two concurrent devices' submissions actually execute
// in, both devices' contributions always survive in the final total.
router.post('/', (req, res) => {
  const { table_id, items } = req.body;
  if (!table_id || !items || !items.length) return res.status(400).json({ error: 'table_id and items required' });

  if (_pendingTables.has(table_id)) return res.status(409).json({ error: 'Order already being processed. Please wait.' });
  _pendingTables.add(table_id);

  try {
    let order, isNew;

    const saveOrder = db.transaction(() => {
      const existingActive = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(table_id);

      if (existingActive) {
        const findExisting = db.prepare(
          'SELECT id FROM order_items WHERE order_id = ? AND menu_item_id = ? AND note = ?'
        );
        const updateQty  = db.prepare('UPDATE order_items SET quantity = quantity + ? WHERE id = ?');
        const insertItem = db.prepare(
          'INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const it of items) {
          const note = it.note || '';
          const existingRow = findExisting.get(existingActive.id, it.menu_item_id, note);
          if (existingRow) {
            updateQty.run(parseInt(it.quantity), existingRow.id);
          } else {
            insertItem.run(existingActive.id, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), note);
          }
        }
        recalcTotal(existingActive.id);
        isNew = false;
        return getOrderWithItems(existingActive.id);
      }

      const tableRow = db.prepare("SELECT status FROM tables WHERE id = ?").get(table_id);
      const tableIsOccupied = tableRow && tableRow.status !== 'empty';

      let sessionId;
      if (tableIsOccupied) {
        const existingSession = db.prepare(
          "SELECT session_id FROM orders WHERE table_id = ? AND status IN ('active','delivered') ORDER BY created_at DESC LIMIT 1"
        ).get(table_id);
        sessionId = existingSession?.session_id ?? uuidv4();
      } else {
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
      req.io.emit('order_additions', { orderId: order.id, tableId: order.table_id, additions: items, createdAt: new Date().toISOString() });
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
        const existingSession = db.prepare(
          "SELECT session_id FROM orders WHERE table_id = ? AND status IN ('active','delivered') ORDER BY created_at DESC LIMIT 1"
        ).get(table_id);
        sessionId = existingSession?.session_id ?? uuidv4();
      } else {
        sessionId = uuidv4();
      }

      const orderId = uuidv4();
      const now     = new Date().toISOString();

      db.prepare('INSERT INTO orders (id, table_id, session_id, status, created_at, delivered_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(orderId, table_id, sessionId, 'delivered', now, now);

      db.prepare("UPDATE tables SET status = 'waiting_bill' WHERE id = ?").run(table_id);

      const ins = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');
      for (const it of items) ins.run(orderId, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), it.note || '');
      recalcTotal(orderId);

      return getOrderWithItems(orderId);
    })();

    req.io.emit('tables_updated');
    res.status(201).json(order);
  } catch (err) {
    console.error('[Orders] Direct-bill error:', err.message);
    res.status(500).json({ error: 'Failed to create direct-bill order.' });
  } finally {
    _pendingTables.delete(table_id);
  }
});

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
        const tableNowEmpty = other === 0;
        if (tableNowEmpty) db.prepare("UPDATE tables SET status = 'empty' WHERE id = ?").run(order.table_id);
        return {
          cancelled: true, order_cancelled: true, table_id: order.table_id,
          cancelledItem, orderStatus: order.status, tableNowEmpty,
        };
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
        tableNowEmpty: result.tableNowEmpty,
      });
      if (result.tableNowEmpty) {
        req.io.emit('order_closed', { orderId: req.params.id, tableId: result.table_id });
      }
      req.io.emit('tables_updated');
    } else {
      req.io.emit('order_updated', { order: result.updatedOrder, isNew: false });
      req.io.emit('order_item_cancelled', {
        orderId: req.params.id,
        tableId: result.updatedOrder.table_id,
        cancelledItem: result.cancelledItem,
        orderStatus: result.orderStatus,
        updatedOrder: result.updatedOrder,
        tableNowEmpty: false,
      });
    }
    res.json(result.updatedOrder || { success: true });
  } catch (err) {
    console.error('[Orders] Cancel item error:', err.message);
    res.status(500).json({ error: 'Failed to cancel item' });
  }
});

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
      const tableNowEmpty = other === 0;
      if (tableNowEmpty) db.prepare("UPDATE tables SET status = 'empty' WHERE id = ?").run(order.table_id);

      return {
        success: true,
        table_id: order.table_id,
        tableId: order.table_id,
        items,
        orderStatus: order.status,
        tableNowEmpty,
      };
    });

    const result = cancel();
    if (!result) return res.status(404).json({ error: 'Order not found' });
    if (result.error) return res.status(400).json({ error: result.error });

    if (result.tableNowEmpty) {
      req.io.emit('order_closed', { orderId: req.params.id, tableId: result.table_id });
    }
    req.io.emit('tables_updated');
    req.io.emit('order_round_cancelled', {
      orderId: req.params.id,
      tableId: result.tableId,
      cancelledItems: result.items,
      orderStatus: result.orderStatus,
      tableNowEmpty: result.tableNowEmpty,
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

router.patch('/:id/close', (req, res) => {
  const orderId = req.params.id;

  const orderRow = db.prepare('SELECT table_id, session_id FROM orders WHERE id = ?').get(orderId);
  if (!orderRow) return res.status(404).json({ error: 'Order not found' });

  const lockKey = `table:${orderRow.table_id}`;

  if (_closingOrders.has(lockKey)) {
    return res.status(409).json({ error: 'This table is already being closed. Please wait.' });
  }
  _closingOrders.add(lockKey);

  const { payment_method, payment_details, change_amount, customer_name, customer_phone, customer_gstin, amount_paid, order_type } = req.body || {};

  try {
    const close = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order) return { notFound: true };

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
      const custGstin  = customer_gstin || null;
      const orderType  = (order_type === 'parcel') ? 'parcel' : 'dine_in';

      const taxPct = getTaxPercent();

      const allSessionOrders = db.prepare(
        "SELECT total FROM orders WHERE table_id = ? AND session_id = ? AND status IN ('active','delivered')"
      ).all(order.table_id, order.session_id);
      const sessionSubtotal = allSessionOrders.reduce((s, r) => s + (r.total || 0), 0);
      const billTotal = sessionSubtotal * (1 + taxPct);

      const paidAmount = typeof amount_paid === 'number' && !Number.isNaN(amount_paid)
        ? amount_paid
        : billTotal;

      db.prepare(`
        UPDATE orders
        SET status = 'closed',
            customer_name   = ?,
            customer_phone  = ?,
            customer_gstin  = ?,
            order_type      = ?,
            tax_percent_snapshot = ?
        WHERE table_id = ?
          AND session_id = ?
          AND status IN ('active','delivered')
      `).run(custName, custPhone, custGstin, orderType, taxPct * 100, order.table_id, order.session_id);

      db.prepare(`
        UPDATE orders
        SET payment_method  = ?,
            payment_details = ?,
            change_amount   = ?,
            amount_paid     = ?
        WHERE id = ?
      `).run(payMethod, payDetails, change, paidAmount, orderId);

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

router.patch('/:id/payment', (req, res) => {
  const { payment_method, payment_details, change_amount, customer_name, customer_phone, customer_gstin, amount_paid, order_type } = req.body || {};
  if (!payment_method) return res.status(400).json({ error: 'payment_method required' });

  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const payDetails = payment_details ? JSON.stringify(payment_details) : null;
    const change     = typeof change_amount === 'number' ? change_amount : 0;
    const paidAmount = typeof amount_paid === 'number' && !Number.isNaN(amount_paid) ? amount_paid : null;
    const orderType  = order_type === 'parcel' || order_type === 'dine_in' ? order_type : null;
    const custGstin  = customer_gstin || null;

    const canonical = order.session_id
      ? db.prepare(
          "SELECT id FROM orders WHERE table_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 1"
        ).get(order.table_id, order.session_id)
      : order;
    const targetId = canonical?.id || req.params.id;

    db.prepare(`
      UPDATE orders
      SET payment_method = ?, payment_details = ?, change_amount = ?,
          customer_name = COALESCE(?, customer_name),
          customer_phone = COALESCE(?, customer_phone),
          customer_gstin = COALESCE(?, customer_gstin),
          amount_paid = ?,
          order_type = COALESCE(?, order_type)
      WHERE id = ?
    `).run(payment_method, payDetails, change,
           customer_name || null, customer_phone || null, custGstin,
           paidAmount, orderType,
           targetId);

    if (order.session_id) {
      db.prepare(`
        UPDATE orders
        SET amount_paid = NULL
        WHERE table_id = ? AND session_id = ? AND id != ?
      `).run(order.table_id, order.session_id, targetId);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Orders] Payment update error:', err.message);
    res.status(500).json({ error: `Failed to update payment: ${err.message}` });
  }
});

module.exports = router;