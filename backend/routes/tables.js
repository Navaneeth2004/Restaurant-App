const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// NOTE: sort_order column is included in the CREATE TABLE schema in database.js

// ── Local-day helpers — same tz_offset_min-aware pattern reports.js uses ───
// FIX: /:id/stats previously computed "today" as `new Date().toISOString()
// .split('T')[0]` — pure server UTC with zero timezone awareness. For an
// IST-based restaurant (UTC+5:30), that means "today" doesn't roll over
// until 5:30am local time instead of local midnight, so orders placed in
// the first ~5.5 hours of the local day were still being counted against
// the PREVIOUS day's bucket. That's why "today's" stats (and messages like
// "High-demand spot today") appeared to carry over past midnight instead
// of resetting. Now accepts the same tz_offset_min query param the rest of
// the reports already use.
function getLocalToday(tzOffsetMin) {
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const now = new Date(Date.now() + offset * 60000);
  return now.toISOString().split('T')[0];
}

function localDateExprAliased(alias, tzOffsetMin) {
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const sign = offset >= 0 ? '+' : '-';
  const mins = Math.abs(Math.round(offset));
  return `substr(datetime(${alias}.created_at, '${sign}${mins} minutes'), 1, 10)`;
}

router.get('/', (req, res) => {
  // occupied_since must consider every OPEN status — active, delivered,
  // AND billed_direct — so a directly-billed table still shows a timer
  // and "occupied" badge until it's actually closed/paid.
  const tables = db.prepare(`
    SELECT t.*,
      o.created_at AS occupied_since
    FROM tables t
    LEFT JOIN orders o
      ON o.table_id = t.id
      AND o.status IN ('active', 'delivered', 'billed_direct')
      AND o.created_at = (
        SELECT MIN(o2.created_at)
        FROM orders o2
        WHERE o2.table_id = t.id
          AND o2.status IN ('active', 'delivered', 'billed_direct')
      )
    WHERE (t.is_archived IS NULL OR t.is_archived = 0)
    ORDER BY t.sort_order ASC, t.id ASC
  `).all();
  res.json(tables);
});

// GET /api/tables/:id/stats — today's performance for this specific table
// FIX: now timezone-aware via tz_offset_min (see helpers above).
router.get('/:id/stats', (req, res) => {
  const tzOffsetMin = req.query.tz_offset_min !== undefined ? parseInt(req.query.tz_offset_min, 10) : 0;
  const today    = getLocalToday(tzOffsetMin);
  const dateExpr = localDateExprAliased('o', tzOffsetMin);

  const rows = db.prepare(`
    SELECT o.id, o.created_at, o.total,
      (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) AS items
    FROM orders o
    WHERE o.table_id = ?
      AND o.status IN ('delivered','closed')
      AND ${dateExpr} = ?
    ORDER BY o.created_at DESC
  `).all(req.params.id, today);

  const revenue_today   = rows.reduce((s, r) => s + (r.total || 0), 0);
  const orders_today    = rows.length;
  const items_today     = rows.reduce((s, r) => s + (r.items || 0), 0);
  const avg_order_value = orders_today > 0 ? revenue_today / orders_today : 0;
  const last_order_at   = rows[0]?.created_at || null;

  res.json({ orders_today, revenue_today, items_today, avg_order_value, last_order_at });
});

router.post('/', (req, res) => {
  const { label, seats } = req.body;
  if (!label) return res.status(400).json({ error: 'Label required' });
  const existing = db.prepare('SELECT id FROM tables').all().map(t => t.id);
  let n = existing.length + 1;
  let newId = `T${n}`;
  while (existing.includes(newId)) { n++; newId = `T${n}`; }
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM tables').get().m ?? 0;
  db.prepare('INSERT INTO tables (id, label, seats, sort_order) VALUES (?, ?, ?, ?)').run(newId, label.trim(), parseInt(seats) || 4, maxOrder + 1);
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(newId);
  req.io.emit('tables_updated');
  res.status(201).json(table);
});

router.put('/:id', (req, res) => {
  const { label, seats, status } = req.body;
  db.prepare('UPDATE tables SET label = COALESCE(?, label), seats = COALESCE(?, seats), status = COALESCE(?, status) WHERE id = ?')
    .run(label || null, seats ? parseInt(seats) : null, status || null, req.params.id);
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
  req.io.emit('tables_updated', { table });
  res.json(table);
});

// PATCH reorder tables
router.patch('/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
  const upd = db.prepare('UPDATE tables SET sort_order = ? WHERE id = ?');
  const reorder = db.transaction(() => { order.forEach(({ id, sort_order }) => upd.run(sort_order, id)); });
  reorder();
  req.io.emit('tables_updated');
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  if (table.status !== 'empty') {
    return res.status(400).json({ error: 'Cannot delete an occupied table. Clear the order and mark as paid first.' });
  }
  const active = db.prepare("SELECT id FROM orders WHERE table_id = ? AND status IN ('active','delivered','billed_direct')").get(req.params.id);
  if (active) return res.status(400).json({ error: 'Table has an active order. Close it first.' });
  db.prepare('DELETE FROM tables WHERE id = ?').run(req.params.id);
  req.io.emit('tables_updated');
  res.json({ success: true });
});

module.exports = router;