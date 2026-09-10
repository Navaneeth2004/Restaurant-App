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
 *
 * 4. FIX: ordersCount now counts SESSIONS (distinct session_id values) not
 *    individual order rows. A single dining visit can produce multiple order rows
 *    (multiple kitchen rounds + a direct-bill row), but it is only one "order"
 *    from the restaurant's perspective. Counting rows inflated the figure — e.g.
 *    2 real visits with 2 rounds each showed as 4 orders.
 *
 *    Sessions without a session_id (legacy data) fall back to counting the row
 *    itself, so old data is not broken.
 *
 * 5. FIX (defensive is_parcel/is_archived guard): database.js now migrates these
 *    columns onto the tables table unconditionally at startup, so this route
 *    should never see them missing. This guard is kept anyway as cheap
 *    insurance — falls back to plain counts instead of throwing if the
 *    columns are ever absent for any reason.
 *
 * 6. FIX (dead code removed): billTotalInclTax/paidTotal/paidVsBillDiff were
 *    computed on every /today request via a separate paidRows query + a
 *    per-session accumulation loop, but nothing in the frontend consumes
 *    them — AnalyticsTab.tsx's own comment explains the "Bill vs. Actually
 *    Paid" panel that used to display this was removed because the
 *    underlying calc was misleading. Kept computing it here was dead work
 *    on every request and risked the same flawed number being
 *    reintroduced elsewhere. Removed entirely.
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ── Column-existence guard (mirrors the pattern used in routes/menu.js) ────
function hasColumn(table, col) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    return cols.some(c => c.name === col);
  } catch { return false; }
}

// ── Local-day boundary helper ─────────────────────────────────────────────
function localDateExpr(tzOffsetMin) {
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const sign = offset >= 0 ? '+' : '-';
  const mins = Math.abs(Math.round(offset));
  return `substr(datetime(created_at, '${sign}${mins} minutes'), 1, 10)`;
}

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

  const revenueAndCount = db.prepare(`
    SELECT
      COALESCE(SUM(total), 0) as total,
      COUNT(DISTINCT COALESCE(session_id, id)) as session_count
    FROM orders
    WHERE status = 'closed' AND ${dateExpr} = ?
  `).get(today);

  const activeOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'active'").get();

  const parcelColsExist = hasColumn('tables', 'is_parcel') && hasColumn('tables', 'is_archived');

  let occupiedTables, dineInSeatsTotal, dineInSeatsFilled, parcelsActive;

  if (parcelColsExist) {
    occupiedTables = db.prepare(`
      SELECT COUNT(*) as count FROM tables
      WHERE status IN ('occupied','waiting_bill')
        AND (is_parcel = 0 OR is_parcel IS NULL)
        AND (is_archived = 0 OR is_archived IS NULL)
    `).get();
    dineInSeatsTotal = db.prepare(`
      SELECT SUM(seats) as total FROM tables
      WHERE (is_parcel = 0 OR is_parcel IS NULL)
        AND (is_archived = 0 OR is_archived IS NULL)
    `).get();
    dineInSeatsFilled = db.prepare(`
      SELECT SUM(seats) as filled FROM tables
      WHERE status IN ('occupied','waiting_bill')
        AND (is_parcel = 0 OR is_parcel IS NULL)
        AND (is_archived = 0 OR is_archived IS NULL)
    `).get();
    parcelsActive = db.prepare(`
      SELECT COUNT(*) as c FROM tables
      WHERE is_parcel = 1
        AND (is_archived = 0 OR is_archived IS NULL)
        AND status IN ('occupied','waiting_bill')
    `).get();
  } else {
    console.warn('[Reports] is_parcel/is_archived columns missing on tables — falling back to plain counts. Restart the backend to re-run migrations.');
    occupiedTables    = db.prepare(`SELECT COUNT(*) as count FROM tables WHERE status IN ('occupied','waiting_bill')`).get();
    dineInSeatsTotal  = db.prepare(`SELECT SUM(seats) as total FROM tables`).get();
    dineInSeatsFilled = db.prepare(`SELECT SUM(seats) as filled FROM tables WHERE status IN ('occupied','waiting_bill')`).get();
    parcelsActive     = { c: 0 };
  }

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
    revenue:          revenueAndCount.total,
    ordersCount:      revenueAndCount.session_count,
    activeOrders:     activeOrders.count,
    occupiedTables:   occupiedTables.count,
    dineInSeatsTotal: dineInSeatsTotal.total ?? 0,
    dineInSeatsFilled: dineInSeatsFilled.filled ?? 0,
    parcelsActive:    parcelsActive.c ?? 0,
    topItems,
    paymentBreakdown,
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
router.get('/revenue', (req, res) => {
  const tzOffsetMin = req.query.tz_offset_min !== undefined ? parseInt(req.query.tz_offset_min, 10) : 0;
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const sign = offset >= 0 ? '+' : '-';
  const mins = Math.abs(Math.round(offset));
  const localDay = `substr(datetime(created_at, '${sign}${mins} minutes'), 1, 10)`;

  const rows = db.prepare(`
    SELECT ${localDay} as day,
           SUM(total) as revenue,
           COUNT(DISTINCT COALESCE(session_id, id)) as orders
    FROM orders
    WHERE status = 'closed'
      AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 days')
    GROUP BY day
    ORDER BY day ASC
  `).all();
  res.json(rows);
});

module.exports = router;