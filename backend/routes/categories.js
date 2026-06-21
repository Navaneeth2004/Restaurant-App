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

// PATCH reorder categories
router.patch('/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
  const upd = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
  const reorder = db.transaction(() => { order.forEach(({ id, sort_order }) => upd.run(sort_order, id)); });
  reorder();
  // Don't emit categories_updated here to avoid race condition with optimistic UI
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  // Check for menu items in this category
  const count = db.prepare('SELECT COUNT(*) as c FROM menu_items WHERE category_id = ?').get(req.params.id).c;
  if (count > 0) {
    // FIX: include 'billed_direct' — a direct-billed order can be open
    // (not yet closed/paid) just like 'active' or 'delivered', and its
    // items must not lose their category reference out from under it.
    const inActiveOrder = db.prepare(`
      SELECT COUNT(*) as c FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items m ON oi.menu_item_id = m.id
      WHERE m.category_id = ?
        AND o.status IN ('active', 'delivered', 'billed_direct')
    `).get(req.params.id).c;

    if (inActiveOrder > 0) {
      return res.status(400).json({
        error: `Cannot delete — ${count} item(s) in this category are part of active orders. Close those orders first.`
      });
    }

    return res.status(400).json({
      error: `Cannot delete — this category has ${count} menu item(s). Delete or reassign them first.`
    });
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  req.io.emit('categories_updated');
  res.json({ success: true });
});

module.exports = router;