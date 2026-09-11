'use strict';

/**
 * backend/routes/kiosk.js
 *
 * FIXES:
 * 1. GET /api/kiosk/lan-ip.
 * 2. POST /:token/bill emits 'bill_requested'.
 * 3. POST /:token/order emits 'tables_updated'.
 * 4. resolveToken() excludes archived tables.
 * 5. FIX (#12 — session-scoped kiosk access): the kiosk previously
 *    authenticated purely by table token, with no concept of WHICH
 *    dining session a connected client belongs to. Once a table's
 *    session ended and a new party was seated, anyone holding the old
 *    (still-valid, since table tokens are intentionally permanent)
 *    link could see and interact with the NEW party's live order — not
 *    just place a phantom order, but potentially add items to or
 *    request the bill for a session that isn't theirs. GET /:token now
 *    returns the table's current session_id; POST /:token/order and
 *    POST /:token/bill accept an optional client_session_id and REJECT
 *    the write (409) if it doesn't match the table's actual current
 *    session — a stale client always gets bounced and forced to resync
 *    to reality instead of silently mutating the wrong session. A
 *    client that never had a session yet (table was empty at its own
 *    bootstrap) is unaffected — placing a genuinely first order always
 *    succeeds.
 */

const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto   = require('crypto');
const os       = require('os');
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
  return db.prepare(
    "SELECT * FROM tables WHERE kiosk_token = ? AND (is_archived = 0 OR is_archived IS NULL)"
  ).get(token) || null;
}

// FIX (#12): the table's current "live" session — whoever is sitting there
// right now, if anyone. null means the table is empty / no open session.
function getCurrentSessionId(tableId) {
  const row = db.prepare(`
    SELECT session_id FROM orders
    WHERE table_id = ? AND status IN ('active','delivered')
    ORDER BY created_at DESC LIMIT 1
  `).get(tableId);
  return row?.session_id || null;
}

// ── LAN IP helper ─────────────────────────────────────────────────────────
function getLanIp() {
  const candidates = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const net of iface) {
      if (net.family !== 'IPv4' || net.internal) continue;
      const ip = net.address;
      if (ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip))
        candidates.push(ip);
    }
  }
  return candidates.find(ip => ip.startsWith('192.168.')) ||
         candidates.find(ip => ip.startsWith('10.')) ||
         candidates[0] || null;
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

// ── GET /api/kiosk/lan-ip ─────────────────────────────────────────────────
router.get('/lan-ip', (req, res) => {
  const ip = getLanIp();
  res.json({ ip });
});

// ── POST /api/kiosk/ensure-token ─────────────────────────────────────────
router.post('/ensure-token', (req, res) => {
  const { table_id } = req.body;
  if (!table_id) return res.status(400).json({ error: 'table_id required' });
  const token = ensureToken(table_id);
  if (!token) return res.status(404).json({ error: 'Table not found' });
  res.json({ token });
});

// ── GET /api/kiosk/:token ─────────────────────────────────────────────────
router.get('/:token', (req, res) => {
  const table = resolveToken(req.params.token);
  if (!table) return res.status(404).json({ error: 'Invalid or expired QR code' });

  const S = getSettings();
  const isParcelSlot = /^P\d+$/.test(table.id);

  res.json({
    kiosk_type:    'table',
    table_id:      table.id,
    table_label:   table.label,
    table_seats:   table.seats,
    table_status:  table.status,
    is_parcel:     isParcelSlot,
    // FIX (#12): the client captures this at bootstrap and must present
    // it back on every write — see getCurrentSessionId() comment above.
    session_id:    getCurrentSessionId(table.id),

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
const _pendingKiosk = new Set();

router.post('/:token/order', (req, res) => {
  const table = resolveToken(req.params.token);
  if (!table) return res.status(404).json({ error: 'Invalid QR code' });

  const { items, client_session_id } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'items required' });

  const table_id = table.id;

  // FIX (#12): reject writes from a client whose remembered session no
  // longer matches the table's actual current session — this is what
  // stops a stale/returning client from silently adding items onto a
  // DIFFERENT party's now-live order. A client that never captured a
  // session yet (table was empty at its own bootstrap) sends null/undefined
  // and is unaffected — a genuinely first order always succeeds.
  const currentSessionIdForOrder = getCurrentSessionId(table_id);
  if (currentSessionIdForOrder && client_session_id && client_session_id !== currentSessionIdForOrder) {
    return res.status(409).json({
      error: "This table's session has changed. Please rescan the QR code to continue.",
      session_changed: true,
    });
  }

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
      const orderType = /^P\d+$/.test(table_id) ? 'parcel' : 'dine_in';
      db.prepare(
        'INSERT INTO orders (id, table_id, session_id, status, created_at, order_type) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(orderId, table_id, sessionId, 'active', now, orderType);

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

  // FIX (#12): same session-scoping guard as /order — a stale client can't
  // request the bill for a session that isn't theirs.
  const { client_session_id } = req.body || {};
  const currentSessionIdForBill = getCurrentSessionId(table.id);
  if (currentSessionIdForBill && client_session_id && client_session_id !== currentSessionIdForBill) {
    return res.status(409).json({
      error: "This table's session has changed. Please rescan the QR code to continue.",
      session_changed: true,
    });
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

  req.io.emit('bill_requested', {
    tableId:    table.id,
    tableLabel: table.label,
  });

  res.json({ success: true, message: 'Bill requested. Your waiter will be with you shortly.' });
});

module.exports = router;
module.exports.ensureToken  = ensureToken;
module.exports.generateToken = generateToken;