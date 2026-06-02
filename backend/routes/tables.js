const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const tables = db.prepare('SELECT * FROM tables ORDER BY id').all();
  res.json(tables);
});

router.post('/', (req, res) => {
  const { label, seats } = req.body;
  if (!label) return res.status(400).json({ error: 'Label required' });
  // Auto-generate ID
  const existing = db.prepare('SELECT id FROM tables').all().map(t => t.id);
  let n = existing.length + 1;
  let newId = `T${n}`;
  while (existing.includes(newId)) { n++; newId = `T${n}`; }
  db.prepare('INSERT INTO tables (id, label, seats) VALUES (?, ?, ?)').run(newId, label.trim(), parseInt(seats) || 4);
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

router.delete('/:id', (req, res) => {
  const active = db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'active'").get(req.params.id);
  if (active) return res.status(400).json({ error: 'Table has an active order. Close it first.' });
  db.prepare('DELETE FROM tables WHERE id = ?').run(req.params.id);
  req.io.emit('tables_updated');
  res.json({ success: true });
});

module.exports = router;
