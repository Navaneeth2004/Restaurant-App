const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// NOTE: sort_order column is included in the CREATE TABLE schema in database.js
// No runtime migration needed here.

router.get('/', (req, res) => {
  const tables = db.prepare(`
    SELECT t.*,
      o.created_at AS occupied_since
    FROM tables t
    LEFT JOIN orders o
      ON o.table_id = t.id
      AND o.status = 'active'
    ORDER BY t.sort_order ASC, t.id ASC
  `).all();
  res.json(tables);
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
  const active = db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'active'").get(req.params.id);
  if (active) return res.status(400).json({ error: 'Table has an active order. Close it first.' });
  db.prepare('DELETE FROM tables WHERE id = ?').run(req.params.id);
  req.io.emit('tables_updated');
  res.json({ success: true });
});

module.exports = router;