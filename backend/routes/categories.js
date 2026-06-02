const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get().m || 0;
  const info = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name.trim(), maxOrder + 1);
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  req.io.emit('categories_updated');
  res.status(201).json(cat);
});

router.put('/:id', (req, res) => {
  const { name, sort_order } = req.body;
  db.prepare('UPDATE categories SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order) WHERE id = ?')
    .run(name || null, sort_order ?? null, req.params.id);
  req.io.emit('categories_updated');
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM menu_items WHERE category_id = ?').get(req.params.id).c;
  if (count > 0) return res.status(400).json({ error: 'Category has menu items. Reassign or delete them first.' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  req.io.emit('categories_updated');
  res.json({ success: true });
});

module.exports = router;
