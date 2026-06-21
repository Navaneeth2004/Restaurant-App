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
  try { db.exec(`ALTER TABLE orders ADD COLUMN session_id TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN amount_paid REAL DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'`); } catch (_) {}
})();

// ── Order status model ──────────────────────────────────────────────────
// 'active'        — sent to kitchen, not yet confirmed ready
// 'delivered'     — kitchen confirmed ready (ONLY the kitchen sets this)
// 'billed_direct' — waiter billed it without ever sending to kitchen
//                   (e.g. customer already left, or items don't need prep
//                   tracking). Kitchen never sees these. Distinct from
//                   'delivered' so the UI never claims the kitchen
//                   confirmed something it never saw.
// 'closed'        — paid and done
//
// Table/session model (per product decision: one table = one customer at
// a time, no concurrent sessions):
//   A table's "current visit" = every order on that table with
//   status IN ('active','delivered','billed_direct') — i.e. everything
//   not yet closed. There is no separate session_id join needed; the
//   table_id IS the session boundary, because only one visit can be open
//   on a table at once. Billing/closing a table closes ALL open orders on
//   it, full stop — this prevents orphaned active orders left over from a
//   previous visit lingering after the table is reset.

const OPEN_STATUSES = ['active', 'delivered', 'billed_direct'];
const OPEN_STATUSES_SQL = `('${OPEN_STATUSES.join("','")}')`;

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

/** Returns true if the table has ANY open (non-closed) order right now. */
function tableHasOpenOrder(tableId) {
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM orders WHERE table_id = ? AND status IN ${OPEN_STATUSES_SQL}`
  ).get(tableId);
  return row.c > 0;
}

router.get('/active', (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'active' ORDER BY created_at ASC").all();
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// Returns every order belonging to the table's CURRENT open visit.
// A table can only have one open visit at a time, so this is simply
// "every non-closed order on this table" — no session_id matching needed.
// Falls back to the most-recently-closed visit (grouped by closed_at
// proximity) so the bill panel stays populated immediately after payment,
// before the table refresh clears the selection.
router.get('/table/:tableId/all', (req, res) => {
  const open = db.prepare(
    `SELECT * FROM orders WHERE table_id = ? AND status IN ${OPEN_STATUSES_SQL} ORDER BY created_at ASC`
  ).all(req.params.tableId);

  if (open.length > 0) {
    open.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
    return res.json(open);
  }

  // Nothing open — return the most recently closed visit as a single
  // group. "Same visit" = closed orders for this table whose created_at
  // timestamps are within a tight window of each other (covers multi-round
  // closed visits), anchored to the single most recent closed order.
  const last = db.prepare(
    "SELECT * FROM orders WHERE table_id = ? AND status = 'closed' ORDER BY created_at DESC LIMIT 1"
  ).get(req.params.tableId);
  if (!last) return res.json([]);

  const VISIT_GAP_MS = 4 * 60 * 60 * 1000; // 4h — same heuristic used elsewhere for legacy grouping
  const candidates = db.prepare(
    "SELECT * FROM orders WHERE table_id = ? AND status = 'closed' ORDER BY created_at DESC"
  ).all(req.params.tableId);

  const group = [last];
  let anchor = new Date(last.created_at).getTime();
  for (const o of candidates) {
    if (o.id === last.id) continue;
    const t = new Date(o.created_at).getTime();
    if (anchor - t <= VISIT_GAP_MS) { group.push(o); anchor = Math.min(anchor, t); }
    else break; // candidates are DESC ordered, so once the gap is too big, stop
  }

  group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  group.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(group);
});

// Returns the most relevant current order for a table.
router.get('/table/:tableId', (req, res) => {
  let order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(req.params.tableId);
  if (!order) order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'delivered' ORDER BY delivered_at DESC LIMIT 1").get(req.params.tableId);
  if (!order) order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'billed_direct' ORDER BY created_at DESC LIMIT 1").get(req.params.tableId);
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

// ── POST / — Send to Kitchen ────────────────────────────────────────────
// Always safe to call whenever there are cart items, regardless of
// billing state on the table. If an active (in-kitchen) order already
// exists, items are merged into it. Otherwise a fresh 'active' order is
// created. This never looks at session_id — table_id is the only scope
// that matters, since only one visit can be open per table.
router.post('/', (req, res) => {
  const { table_id, items } = req.body;
  if (!table_id || !items || !items.length) return res.status(400).json({ error: 'table_id and items required' });

  if (_pendingTables.has(table_id)) return res.status(409).json({ error: 'Order already being processed. Please wait.' });
  _pendingTables.add(table_id);

  try {
    let order, isNew, newItems = [];

    const saveOrder = db.transaction(() => {
      const existingActive = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(table_id);
      const existing = existingActive || null;

      if (existing) {
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
        const orderId = uuidv4();
        const now = new Date().toISOString();
        db.prepare('INSERT INTO orders (id, table_id, status, created_at) VALUES (?, ?, ?, ?)')
          .run(orderId, table_id, 'active', now);
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

// ── POST /direct-bill ─────────────────────────────────────────────────────
// Creates an order in 'billed_direct' state — bypasses kitchen entirely.
// Distinct from 'delivered': 'delivered' means the KITCHEN confirmed it.
// 'billed_direct' means the waiter billed it without the kitchen ever
// seeing it (customer already left, or items need no prep tracking).
// This NEVER disables or interferes with Send to Kitchen — it's an
// independent action a waiter can take any time there are unsent items
// for a table, whether or not that table also has an active kitchen
// round (rounds 2, 3, ... can all be direct-billed individually; only
// the round actually being billed is affected).
router.post('/direct-bill', (req, res) => {
  const { table_id, items } = req.body;
  if (!table_id || !items || !items.length) return res.status(400).json({ error: 'table_id and items required' });

  if (_pendingTables.has(table_id)) return res.status(409).json({ error: 'Order already being processed. Please wait.' });
  _pendingTables.add(table_id);

  try {
    const order = db.transaction(() => {
      const orderId = uuidv4();
      const now     = new Date().toISOString();

      // No delivered_at — it was never delivered by the kitchen.
      db.prepare('INSERT INTO orders (id, table_id, status, created_at) VALUES (?, ?, ?, ?)')
        .run(orderId, table_id, 'billed_direct', now);

      // Table is occupied by this visit if it wasn't already (covers the
      // "customer left without anyone marking it" case: a fresh direct
      // bill on an empty table still needs to mark it occupied first so
      // closing it afterwards behaves normally).
      const tableRow = db.prepare("SELECT status FROM tables WHERE id = ?").get(table_id);
      if (!tableRow || tableRow.status === 'empty') {
        db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table_id);
      }

      const ins = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');
      for (const it of items) ins.run(orderId, it.menu_item_id, it.name, parseFloat(it.price), parseInt(it.quantity), it.note || '');
      recalcTotal(orderId);

      return getOrderWithItems(orderId);
    })();

    // Only emit tables_updated — no new_order, no order_updated targeting
    // kitchen — kitchen must never see billed_direct orders.
    req.io.emit('tables_updated');
    res.status(201).json(order);
  } catch (err) {
    console.error('[Orders] Direct-bill error:', err.message);
    res.status(500).json({ error: 'Failed to create direct-bill order.' });
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
        // Delete the order entirely — never billed so must not appear in reports
        db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
        // Only empty the table if NOTHING else is open on it. Scoped by
        // table_id alone now — correct because a table can only have one
        // open visit at a time, so "anything else open" really does mean
        // "is the visit actually over."
        const other = db.prepare(
          `SELECT COUNT(*) as c FROM orders WHERE table_id = ? AND status IN ${OPEN_STATUSES_SQL} AND id != ?`
        ).get(order.table_id, req.params.id).c;
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

      // DELETE entirely — cancelled orders were never billed and must not
      // appear in reports history.
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
      db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);

      // Only free the table if nothing else is open on it (table-scoped,
      // not session-scoped — see note above).
      const other = db.prepare(
        `SELECT COUNT(*) as c FROM orders WHERE table_id = ? AND status IN ${OPEN_STATUSES_SQL}`
      ).get(order.table_id).c;
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

// Helper: compute the bill total (incl. tax) for ALL open orders on a
// table, so amount_paid can be validated/derived consistently server-side.
// Table-scoped, not session_id-scoped (see status model note at top).
function getTableBillTotal(tableId, taxPct) {
  const rows = db.prepare(
    `SELECT total FROM orders WHERE table_id = ? AND status IN ${OPEN_STATUSES_SQL}`
  ).all(tableId);
  const subtotal = rows.reduce((s, r) => s + (r.total || 0), 0);
  return subtotal * (1 + taxPct);
}

function getTaxPercent() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'tax_percent'").get();
  return parseFloat(row?.value ?? '5') / 100;
}

// ── PATCH close order with payment details ─────────────────────────────────
// Closing a table closes EVERY open order on that table (active,
// delivered, AND billed_direct) — not just orders matching some derived
// session id. This guarantees no order is ever left dangling on a table
// after it's billed, and the table can safely flip to 'empty' for the
// next customer.
router.patch('/:id/close', (req, res) => {
  const orderId = req.params.id;

  const orderRow = db.prepare('SELECT table_id FROM orders WHERE id = ?').get(orderId);
  if (!orderRow) return res.status(404).json({ error: 'Order not found' });

  const lockKey = `table:${orderRow.table_id}`;

  if (_closingOrders.has(lockKey)) {
    return res.status(409).json({ error: 'This table is already being closed. Please wait.' });
  }
  _closingOrders.add(lockKey);

  const { payment_method, payment_details, change_amount, customer_name, customer_phone, amount_paid, order_type } = req.body || {};

  try {
    try { db.exec(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN payment_details TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN change_amount REAL DEFAULT 0`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN customer_phone TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN session_id TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN amount_paid REAL DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'`); } catch (_) {}

    const close = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order) return { notFound: true };
      if (order.status === 'closed') return { alreadyClosed: true, table_id: order.table_id };

      const payMethod  = payment_method  || 'cash';
      const payDetails = payment_details ? JSON.stringify(payment_details) : null;
      const change     = typeof change_amount === 'number' ? change_amount : 0;
      const custName   = customer_name  || null;
      const custPhone  = customer_phone || null;
      const orderType  = (order_type === 'parcel') ? 'parcel' : 'dine_in';

      const taxPct     = getTaxPercent();
      const billTotal  = getTableBillTotal(order.table_id, taxPct);
      const paidAmount = typeof amount_paid === 'number' && !Number.isNaN(amount_paid)
        ? amount_paid
        : billTotal;

      // Close EVERY open order on this table — not just ones sharing a
      // session_id. This is what guarantees nothing is left dangling.
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
          AND status IN ${OPEN_STATUSES_SQL}
      `).run(payMethod, payDetails, change, custName, custPhone, paidAmount, orderType, order.table_id);

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
  const { payment_method, payment_details, change_amount, customer_name, customer_phone, amount_paid, order_type } = req.body || {};
  if (!payment_method) return res.status(400).json({ error: 'payment_method required' });

  try {
    try { db.exec(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN payment_details TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN change_amount REAL DEFAULT 0`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN customer_phone TEXT DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN amount_paid REAL DEFAULT NULL`); } catch (_) {}
    try { db.exec(`ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'`); } catch (_) {}

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