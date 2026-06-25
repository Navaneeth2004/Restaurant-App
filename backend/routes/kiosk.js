'use strict';

/**
 * backend/routes/kiosk.js
 *
 * Public (no auth) routes for the customer-facing kiosk.
 * The kiosk is identified by an opaque token — customers never see the table ID.
 *
 * Designed to be extensible: the token resolves to a "kiosk context" that can
 * later support non-table kiosks (e.g. McDonald's-style walk-up ordering) by
 * just changing what the token points to.
 *
 * Routes (all unauthenticated — token is the security):
 *   GET  /api/kiosk/:token            — resolve token → table info + settings
 *   GET  /api/kiosk/:token/menu        — menu items + categories for this kiosk
 *   GET  /api/kiosk/:token/orders      — current open orders for this table
 *   POST /api/kiosk/:token/order       — place/add-to order
 *   POST /api/kiosk/:token/bill        — request bill (sets table → waiting_bill)
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

/**
 * Generate a URL-safe token that looks nothing like a table ID.
 * 24 random bytes → 32-char base64url string.
 */
function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Ensure a table has a kiosk token; create one if missing.
 * Returns the token.
 */
function ensureToken(tableId) {
  const row = db.prepare('SELECT kiosk_token FROM tables WHERE id = ?').get(tableId);
  if (!row) return null;
  if (row.kiosk_token) return row.kiosk_token;
  const token = generateToken();
  db.prepare('UPDATE tables SET kiosk_token = ? WHERE id = ?').run(token, tableId);
  return token;
}

/**
 * Resolve a token → table row, or null.
 */
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
// Called by Admin → Tables when generating QR code for a table.
// Creates a token if one doesn't exist, returns it.
router.post('/ensure-token', (req, res) => {
  const { table_id } = req.body;
  if (!table_id) return res.status(400).json({ error: 'table_id required' });
  const token = ensureToken(table_id);
  if (!token) return res.status(404).json({ error: 'Table not found' });
  res.json({ token });
});

// ── GET /api/kiosk/:token ─────────────────────────────────────────────────
// Resolve token → kiosk context (table info + restaurant settings).
// This is the bootstrap call the kiosk page makes on load.
router.get('/:token', (req, res) => {
  const table = resolveToken(req.params.token);
  if (!table) return res.status(404).json({ error: 'Invalid or expired QR code' });

  const S = getSettings();

  res.json({
    // Kiosk context — what the UI needs to know
    kiosk_type:    'table',          // future: 'standalone' for walk-up kiosks
    table_id:      table.id,
    table_label:   table.label,
    table_seats:   table.seats,
    table_status:  table.status,

    // Restaurant identity for branding the kiosk page
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
// Returns available menu items + categories for the kiosk.
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
// Returns current open orders for this table (same session).
router.get('/:token/orders', (req, res) => {
  const table = resolveToken(req.params.token);
  if (!table) return res.status(404).json({ error: 'Invalid QR code' });

  // Find the current session (same logic as orders route)
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
// Place a new order or add items to the current active order.
// Mirrors POST /api/orders but scoped to the kiosk's table.
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
      const existingActive = db.prepare(
        "SELECT * FROM orders WHERE table_id = ? AND status = 'active'"
      ).get(table_id);

      if (existingActive) {
        // Add-to-order: diff against existing items
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

      // New order
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
      return getOrderWithItems(orderId);
    });

    order = saveOrder();

    // Emit the same socket events the waiter route emits
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
// Customer requests the bill — sets table to waiting_bill.
// The actual payment is handled by the waiter; this is just a signal.
router.post('/:token/bill', (req, res) => {
  const table = resolveToken(req.params.token);
  if (!table) return res.status(404).json({ error: 'Invalid QR code' });

  // Only meaningful if table is occupied
  if (table.status === 'empty') {
    return res.status(400).json({ error: 'No active order on this table.' });
  }

  // Mark all active orders as delivered (same as kitchen "Mark Delivered")
  // so table goes to waiting_bill
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

    // Notify all connected clients
    for (const o of activeOrders) {
      const updated = getOrderWithItems(o.id);
      req.io.emit('order_delivered', { order: updated });
    }
  } else {
    // Already delivered — just ensure waiting_bill status
    db.prepare(
      "UPDATE tables SET status = 'waiting_bill' WHERE id = ?"
    ).run(table.id);
  }

  req.io.emit('tables_updated');
  res.json({ success: true, message: 'Bill requested. Your waiter will be with you shortly.' });
});

// ── Export token utilities for use in tables route ────────────────────────
module.exports = router;
module.exports.ensureToken = ensureToken;
module.exports.generateToken = generateToken;