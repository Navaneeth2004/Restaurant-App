const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// NOTE: sort_order column is included in the CREATE TABLE schema in database.js

router.get('/', (req, res) => {
  // FIX (#6.4): previously correlated occupied_since via
  // `o.created_at = (SELECT MIN(o2.created_at) ...)`, using
  // second-precision timestamps (strftime with no fractional seconds).
  // If two orders for the same table were created within the same
  // second, that correlation was ambiguous — the LEFT JOIN could match
  // MULTIPLE rows with the identical MIN(created_at) value, producing
  // duplicate/incorrect rows for that table in the result set.
  //
  // Now selects a single deterministic row via SQLite's implicit rowid
  // (orders.id is a TEXT PRIMARY KEY, not WITHOUT ROWID, so rowid still
  // exists and increases monotonically with insertion order — a
  // reliable tie-breaker when created_at collides).
  //
  // FIX (#6.5): removed the vestigial 'billed_direct' status from the
  // IN clause — no insert statement anywhere in the codebase ever writes
  // status='billed_direct' (direct-bill orders get 'delivered' with
  // delivered_at ≈ created_at instead), and it's not in the orders
  // table's CHECK constraint either. Referencing it here was misleading
  // — 'active'/'delivered' already cover every order that can exist.
  const tables = db.prepare(`
    SELECT t.*,
      o.created_at AS occupied_since
    FROM tables t
    LEFT JOIN orders o
      ON o.rowid = (
        SELECT o2.rowid
        FROM orders o2
        WHERE o2.table_id = t.id
          AND o2.status IN ('active', 'delivered')
        ORDER BY o2.created_at ASC, o2.rowid ASC
        LIMIT 1
      )
    WHERE (t.is_archived IS NULL OR t.is_archived = 0)
    ORDER BY t.sort_order ASC, t.id ASC
  `).all();
  res.json(tables);
});

// GET /api/tables/:id/stats — today's performance for this specific table
router.get('/:id/stats', (req, res) => {
  const tzOffsetMin = req.query.tz_offset_min !== undefined ? parseInt(req.query.tz_offset_min, 10) : 0;
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const sign = offset >= 0 ? '+' : '-';
  const mins = Math.abs(Math.round(offset));
  const localToday = (() => {
    const now = new Date(Date.now() + offset * 60000);
    return now.toISOString().split('T')[0];
  })();
  const dateExpr = `substr(datetime(o.created_at, '${sign}${mins} minutes'), 1, 10)`;

  const rows = db.prepare(`
    SELECT o.id, o.created_at, o.total,
      (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) AS items
    FROM orders o
    WHERE o.table_id = ?
      AND o.status IN ('delivered','closed')
      AND ${dateExpr} = ?
    ORDER BY o.created_at DESC
  `).all(req.params.id, localToday);

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
  // FIX (#6.5): removed vestigial 'billed_direct' — see comment on GET '/' above.
  const active = db.prepare("SELECT id FROM orders WHERE table_id = ? AND status IN ('active','delivered')").get(req.params.id);
  if (active) return res.status(400).json({ error: 'Table has an active order. Close it first.' });
  db.prepare('DELETE FROM tables WHERE id = ?').run(req.params.id);
  req.io.emit('tables_updated');
  res.json({ success: true });
});

module.exports = router;