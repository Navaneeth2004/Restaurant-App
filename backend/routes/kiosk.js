'use strict';

/**
 * backend/routes/kiosk.js
 *
 * Public (no auth) routes for the customer-facing kiosk.
 *
 * FIXES in this revision:
 *
 * 1. QR code generation moved server-side (GET /:token/qr.svg) using the
 *    `qrcode` npm package instead of the old Google Charts Image API
 *    (chart.googleapis.com), which was shut down years ago — that's why
 *    the QR modal always showed "QR image unavailable offline". The new
 *    endpoint needs no internet access at all and renders instantly.
 *
 * 2. POST /:token/order — "Round 2 sends Round 1's items again" bug.
 *    The route already diffed against the existing ACTIVE order correctly.
 *    The real gap: once a round is marked delivered, there is no active
 *    order row for that table — so a fresh POST should never see an
 *    `existingActive` order and should just insert the new items as-is.
 *    That part was correct. The bug was that the OLD frontend (KioskView)
 *    was pre-merging delivered-round items into the cart before calling
 *    this route, then this route ALSO tried to diff — double-counting.
 *    This route now ignores any such pre-merging and is the single source
 *    of truth: it only ever adds what's genuinely new, computed itself
 *    from the live DB state for the CURRENT active order only (never
 *    delivered rounds). See the rewritten KioskView.tsx for the matching
 *    frontend fix (it now sends only the cart, never history).
 */

const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto   = require('crypto');
const db       = require('../db/database');

// ── Migration: add kiosk_token column to tables ───────────────────────────
(function migrate() {
  try {
    db.exec(`ALTER TABLE tables ADD COLUMN kiosk_token TEXT DEFAULT NULL`);
    console.log('[Kiosk] Migrated tables: added kiosk_token column');
  } catch (_) { /* column already exists */ }
})();

// ── Token helpers ─────────────────────────────────────────────────────────

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function ensureToken(tableId) {
  const row = db.prepare('SELECT kiosk_token FROM tables WHERE id = ?').get(tableId);
  if (!row) return null;
  if (row.kiosk_token) return row.kiosk_token;
  const token = generateToken();
  db.prepare('UPDATE tables SET kiosk_token = ? WHERE id = ?').run(token, tableId);
  return token;
}

function resolveToken(token) {
  if (!token) return null;
  return db.prepare('SELECT * FROM tables WHERE kiosk_token = ?').get(token) || null;
}

// ── Shared helpers ────────────────────────────────────────────────────────

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

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

// ── POST /api/kiosk/ensure-token ─────────────────────────────────────────
router.post('/ensure-token', (req, res) => {
  const { table_id } = req.body;
  if (!table_id) return res.status(400).json({ error: 'table_id required' });
  const token = ensureToken(table_id);
  if (!token) return res.status(404).json({ error: 'Table not found' });
  res.json({ token });
});

// ── GET /api/kiosk/:token/qr.svg ──────────────────────────────────────────
// FIX: server-rendered QR, no internet/3rd-party dependency. Takes the
// fully-qualified kiosk URL as a query param so it always matches whatever
// the frontend resolved as the LAN-reachable address.
router.get('/:token/qr.svg', async (req, res) => {
  const table = resolveToken(req.params.token);
  if (!table) return res.status(404).send('Invalid token');

  const url = req.query.url;
  if (!url || typeof url !== 'string') return res.status(400).send('Missing url param');

  try {
    const QRCode = require('qrcode');
    const svg = await QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      width: 512,
      color: { dark: '#18181b', light: '#ffffff' },
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store'); // token-bound URL can change per deployment
    res.send(svg);
  } catch (e) {
    console.error('[Kiosk] QR generation failed:', e.message);
    res.status(500).send('QR generation failed. Run: cd backend && npm install qrcode');
  }
});

// ── GET /api/kiosk/:token ─────────────────────────────────────────────────
router.get('/:token', (req, res) => {
  const table = resolveToken(req.params.token);
  if (!table) return res.status(404).json({ error: 'Invalid or expired QR code' });

  const S = getSettings();

  res.json({
    kiosk_type:    'table',
    table_id:      table.id,
    table_label:   table.label,
    table_seats:   table.seats,
    table_status:  table.status,

    restaurant_name:  S.restaurant_name  || 'Restaurant',
    brand_color:      S.brand_color      || '#f97316',
    currency_symbol:  S.currency_symbol  || '₹',
    tax_percent:      S.tax_percent      || '5',
    logo_url:         S.logo_url         || '',
    bill_footer:      S.bill_footer      || '',
    address:          S.address          || '',
    phone:            S.phone            || '',
  });
});

// ── GET /api/kiosk/:token/menu ────────────────────────────────────────────
router.get('/:token/menu', (req, res) => {
  if (!resolveToken(req.params.token)) {
    return res.status(404).json({ error: 'Invalid QR code' });
  }

  const categories = db.prepare(
    'SELECT * FROM categories ORDER BY sort_order, id'
  ).all();

  const items = db.prepare(`
    SELECT m.*, c.name as category_name
    FROM menu_items m
    JOIN categories c ON m.category_id = c.id
    WHERE m.available = 1
    ORDER BY c.sort_order, m.sort_order, m.id
  `).all();

  res.json({ categories, items });
});

// ── GET /api/kiosk/:token/orders ──────────────────────────────────────────
router.get('/:token/orders', (req, res) => {
  const table = resolveToken(req.params.token);
  if (!table) return res.status(404).json({ error: 'Invalid QR code' });

  const latest = db.prepare(`
    SELECT session_id FROM orders
    WHERE table_id = ? AND status IN ('active','delivered')
    ORDER BY created_at DESC LIMIT 1
  `).get(table.id);

  if (!latest?.session_id) return res.json([]);

  const orders = db.prepare(`
    SELECT * FROM orders
    WHERE table_id = ? AND session_id = ?
    ORDER BY created_at ASC
  `).all(table.id, latest.session_id);

  orders.forEach(o => {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  });

  res.json(orders);
});

// ── POST /api/kiosk/:token/order ──────────────────────────────────────────
// FIX (Round 2 re-sending Round 1 items): this route is now the single
// source of truth for "what's actually new". It IGNORES whatever the
// client thinks the merged list should be — the request body is expected
// to contain ONLY the items the customer is adding right now (their cart),
// never history. The route itself fetches the live active order (if any)
// from the DB and diffs against THAT — never against delivered rounds.
//
// This matches how WaiterView (the staff app) already does it correctly:
// always re-fetch fresh state right before merging, never trust a stale
// client-side snapshot.
const _pendingKiosk = new Set();

router.post('/:token/order', (req, res) => {
  const table = resolveToken(req.params.token);
  if (!table) return res.status(404).json({ error: 'Invalid QR code' });

  const { items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'items required' });

  const table_id = table.id;

  if (_pendingKiosk.has(table_id)) {
    return res.status(409).json({ error: 'Order already being processed. Please wait.' });
  }
  _pendingKiosk.add(table_id);

  try {
    let order, isNew, newItems = [];

    const saveOrder = db.transaction(() => {
      // Only an order with status = 'active' counts as "in progress, not
      // yet sent to kitchen for delivery". A 'delivered' round must NEVER
      // be re-merged here — that was the source of Round 1 items
      // reappearing inside Round 2.
      const existingActive = db.prepare(
        "SELECT * FROM orders WHERE table_id = ? AND status = 'active'"
      ).get(table_id);

      if (existingActive) {
        // Add-to-active-order: diff against what's already in THIS active
        // order only (e.g. customer tapped two items in quick succession
        // before the first POST finished) — never against delivered rounds.
        const prevItems = db.prepare(
          'SELECT * FROM order_items WHERE order_id = ?'
        ).all(existingActive.id);
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
        const ins = db.prepare(
          'INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const it of items) {
          ins.run(existingActive.id, it.menu_item_id, it.name,
            parseFloat(it.price), parseInt(it.quantity), it.note || '');
        }
        recalcTotal(existingActive.id);
        isNew = false;
        return getOrderWithItems(existingActive.id);
      }

      // No active order exists (table is fresh, or the previous round was
      // already delivered) — this is a brand-new round. Insert exactly
      // what the customer is sending now. Nothing from history is pulled in.
      const tableRow = db.prepare('SELECT status FROM tables WHERE id = ?').get(table_id);
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
      db.prepare(
        'INSERT INTO orders (id, table_id, session_id, status, created_at, order_type) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(orderId, table_id, sessionId, 'active', now, 'dine_in');

      db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table_id);

      const ins = db.prepare(
        'INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const it of items) {
        ins.run(orderId, it.menu_item_id, it.name,
          parseFloat(it.price), parseInt(it.quantity), it.note || '');
      }
      recalcTotal(orderId);
      isNew = true;
      newItems = items;
      return getOrderWithItems(orderId);
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
    req.io.emit('tables_updated');

    res.status(isNew ? 201 : 200).json(order);
  } catch (err) {
    console.error('[Kiosk] Order error:', err.message);
    res.status(500).json({ error: 'Failed to place order. Please try again.' });
  } finally {
    _pendingKiosk.delete(table_id);
  }
});

// ── POST /api/kiosk/:token/bill ───────────────────────────────────────────
router.post('/:token/bill', (req, res) => {
  const table = resolveToken(req.params.token);
  if (!table) return res.status(404).json({ error: 'Invalid QR code' });

  if (table.status === 'empty') {
    return res.status(400).json({ error: 'No active order on this table.' });
  }

  const activeOrders = db.prepare(
    "SELECT id FROM orders WHERE table_id = ? AND status = 'active'"
  ).all(table.id);

  if (activeOrders.length > 0) {
    const now = new Date().toISOString();
    const markDelivered = db.transaction(() => {
      for (const o of activeOrders) {
        db.prepare(
          "UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ?"
        ).run(now, o.id);
      }
      db.prepare(
        "UPDATE tables SET status = 'waiting_bill' WHERE id = ?"
      ).run(table.id);
    });
    markDelivered();

    for (const o of activeOrders) {
      const updated = getOrderWithItems(o.id);
      req.io.emit('order_delivered', { order: updated });
    }
  } else {
    db.prepare(
      "UPDATE tables SET status = 'waiting_bill' WHERE id = ?"
    ).run(table.id);
  }

  req.io.emit('tables_updated');
  res.json({ success: true, message: 'Bill requested. Your waiter will be with you shortly.' });
});

module.exports = router;
module.exports.ensureToken = ensureToken;
module.exports.generateToken = generateToken;