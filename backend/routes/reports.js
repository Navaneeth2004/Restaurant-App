/**
 * backend/routes/reports.js
 *
 * FIXES:
 * 1. topItems query: the column reference `created_at` was ambiguous when
 *    joining order_items with orders — it could resolve to order_items.created_at
 *    (which doesn't exist) depending on SQLite version. Fixed to always use
 *    `o.created_at` with the explicit table alias.
 *
 * 2. The /today route now counts ALL closed orders for the day, including
 *    direct-bill orders (status = 'closed', which they become after payment).
 *    Previously these were already included, but the topItems join was dropping
 *    them due to the ambiguous column reference bug.
 *
 * 3. Revenue chart groups by local date using the same timezone-aware expression
 *    so the chart matches what the /today summary shows.
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ── Local-day boundary helper ─────────────────────────────────────────────
function localDateExpr(tzOffsetMin) {
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const sign = offset >= 0 ? '+' : '-';
  const mins = Math.abs(Math.round(offset));
  return `substr(datetime(created_at, '${sign}${mins} minutes'), 1, 10)`;
}

// Same but with explicit table alias (prevents ambiguity in JOINs)
function localDateExprAliased(alias, tzOffsetMin) {
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const sign = offset >= 0 ? '+' : '-';
  const mins = Math.abs(Math.round(offset));
  return `substr(datetime(${alias}.created_at, '${sign}${mins} minutes'), 1, 10)`;
}

function getLocalToday(tzOffsetMin) {
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const now = new Date(Date.now() + offset * 60000);
  return now.toISOString().split('T')[0];
}

// ── GET /today ────────────────────────────────────────────────────────────
router.get('/today', (req, res) => {
  const tzOffsetMin  = req.query.tz_offset_min !== undefined ? parseInt(req.query.tz_offset_min, 10) : 0;
  const today        = getLocalToday(tzOffsetMin);
  const dateExpr     = localDateExpr(tzOffsetMin);
  const dateExprO    = localDateExprAliased('o', tzOffsetMin);

  const revenue = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
    FROM orders
    WHERE status = 'closed' AND ${dateExpr} = ?
  `).get(today);

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S      = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const taxPct = parseFloat(S.tax_percent || '5') / 100;

  // Paid vs bill totals
  const paidRows = db.prepare(`
    SELECT total, amount_paid
    FROM orders
    WHERE status = 'closed' AND ${dateExpr} = ?
  `).all(today);

  let billTotalInclTax = 0;
  let paidTotal        = 0;
  paidRows.forEach(o => {
    const billIncl = o.total * (1 + taxPct);
    billTotalInclTax += billIncl;
    paidTotal += (typeof o.amount_paid === 'number' && o.amount_paid !== null) ? o.amount_paid : billIncl;
  });

  const activeOrders   = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'active'").get();
  const occupiedTables = db.prepare("SELECT COUNT(*) as count FROM tables WHERE status != 'empty'").get();

  // FIX: use aliased date expression to avoid column ambiguity in the JOIN
  const topItems = db.prepare(`
    SELECT oi.name,
           SUM(oi.quantity)          AS total_qty,
           SUM(oi.price * oi.quantity) AS total_rev
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status = 'closed'
      AND ${dateExprO} = ?
    GROUP BY oi.name
    ORDER BY total_qty DESC
    LIMIT 5
  `).all(today);

  const paymentBreakdown = db.prepare(`
    SELECT payment_method, COUNT(*) as count, SUM(total) as total
    FROM orders
    WHERE status = 'closed' AND ${dateExpr} = ?
    GROUP BY payment_method
  `).all(today);

  res.json({
    revenue:          revenue.total,
    ordersCount:      revenue.count,
    activeOrders:     activeOrders.count,
    occupiedTables:   occupiedTables.count,
    topItems,
    paymentBreakdown,
    billTotalInclTax: parseFloat(billTotalInclTax.toFixed(2)),
    paidTotal:        parseFloat(paidTotal.toFixed(2)),
    paidVsBillDiff:   parseFloat((paidTotal - billTotalInclTax).toFixed(2)),
  });
});

// ── GET /history ──────────────────────────────────────────────────────────
router.get('/history', (req, res) => {
  const { from, to, limit = 200, tz_offset_min } = req.query;
  const tzOffsetMin = tz_offset_min !== undefined ? parseInt(tz_offset_min, 10) : 0;
  const dateExpr = localDateExpr(tzOffsetMin);

  let q = "SELECT * FROM orders WHERE status = 'closed'";
  const p = [];
  if (from) { q += ` AND ${dateExpr} >= ?`; p.push(from); }
  if (to)   { q += ` AND ${dateExpr} <= ?`; p.push(to); }
  q += ' ORDER BY created_at DESC LIMIT ?';
  p.push(parseInt(limit));

  const orders = db.prepare(q).all(...p);
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

// ── GET /revenue ──────────────────────────────────────────────────────────
// FIX: Use local-date grouping consistent with the /today endpoint.
// Previously used substr(created_at,1,10) which is UTC-based, causing the
// day boundary to be different from what /today reports.
router.get('/revenue', (req, res) => {
  // Default to UTC if no tz param; clients send tz_offset_min in other queries
  const tzOffsetMin = req.query.tz_offset_min !== undefined ? parseInt(req.query.tz_offset_min, 10) : 0;
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const sign = offset >= 0 ? '+' : '-';
  const mins = Math.abs(Math.round(offset));
  const localDay = `substr(datetime(created_at, '${sign}${mins} minutes'), 1, 10)`;

  const rows = db.prepare(`
    SELECT ${localDay} as day, SUM(total) as revenue, COUNT(*) as orders
    FROM orders
    WHERE status = 'closed'
      AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 days')
    GROUP BY day
    ORDER BY day ASC
  `).all();
  res.json(rows);
});

module.exports = router;
