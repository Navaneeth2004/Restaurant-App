'use strict';
/**
 * /api/menu — menu items.
 * Photos are stored per restaurant (core/files.js). The schema (core/schema.js) already guarantees the
 * sort_order column, so the old "seed / check column" helpers are gone.
 */
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const files = require('../core/files');

const upload = files.makeUploader('item', 5);

const ITEM_SELECT = `
  SELECT m.*, c.name AS category_name
  FROM menu_items m JOIN categories c ON m.category_id = c.id`;

router.get('/', (req, res) => {
  res.json(db.prepare(`${ITEM_SELECT} ORDER BY c.sort_order, m.sort_order, m.id`).all());
});

router.get('/category/:catId', (req, res) => {
  res.json(db.prepare(`${ITEM_SELECT} WHERE m.category_id = ? ORDER BY m.sort_order, m.id`).all(req.params.catId));
});

router.post('/', upload.single('image'), (req, res) => {
  const { name, description, price, category_id } = req.body;
  if (!name || !price || !category_id) return res.status(400).json({ error: 'name, price, category_id required' });
  const imagePath = req.file ? files.publicUrl(req.restaurantId, req.file.filename) : null;

  try {
    const maxRow = db.prepare('SELECT MAX(sort_order) AS m FROM menu_items WHERE category_id = ?').get(parseInt(category_id));
    const info = db.prepare(
      'INSERT INTO menu_items (name, description, price, category_id, image_path, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(String(name).trim().slice(0, 80), description || '', parseFloat(price), parseInt(category_id), imagePath, (maxRow && maxRow.m || 0) + 1);

    const item = db.prepare(`${ITEM_SELECT} WHERE m.id = ?`).get(info.lastInsertRowid);
    req.io.emit('menu_updated');
    res.status(201).json(item);
  } catch (e) {
    if (req.file) files.removeUpload(req.restaurantId, req.file.filename);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', upload.single('image'), (req, res) => {
  const { name, description, price, category_id, available } = req.body;
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) {
    if (req.file) files.removeUpload(req.restaurantId, req.file.filename);
    return res.status(404).json({ error: 'Not found' });
  }

  let imagePath = existing.image_path;
  if (req.file) {
    if (existing.image_path) files.removeUpload(req.restaurantId, existing.image_path);
    imagePath = files.publicUrl(req.restaurantId, req.file.filename);
  }

  db.prepare(`
    UPDATE menu_items SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      category_id = COALESCE(?, category_id),
      image_path = ?,
      available = COALESCE(?, available)
    WHERE id = ?
  `).run(
    name || null,
    description === undefined ? null : description,
    price ? parseFloat(price) : null,
    category_id ? parseInt(category_id) : null,
    imagePath,
    available !== undefined ? (available === 'true' || available === true ? 1 : 0) : null,
    req.params.id
  );

  const item = db.prepare(`${ITEM_SELECT} WHERE m.id = ?`).get(req.params.id);
  req.io.emit('menu_updated');
  res.json(item);
});

router.patch('/reorder', (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
  try {
    const update = db.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?');
    db.transaction((rows) => { for (const { id, sort_order } of rows) update.run(sort_order, id); })(items);
    req.io.emit('menu_updated');
    res.json({ ok: true });
  } catch (err) {
    console.error('Reorder failed:', err.message);
    res.status(500).json({ error: 'Reorder failed' });
  }
});

router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const inUse = db.prepare(`
    SELECT oi.id FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.menu_item_id = ? AND o.status IN ('active', 'delivered')
    LIMIT 1
  `).get(req.params.id);
  if (inUse) {
    return res.status(400).json({ error: 'This item is part of an active or pending order. Cannot delete until those orders are closed.' });
  }

  if (item.image_path) files.removeUpload(req.restaurantId, item.image_path);
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  req.io.emit('menu_updated');
  res.json({ success: true });
});

// Friendly JSON for upload errors (wrong file type, too large)
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5 MB).' : err.message });
  next();
});

module.exports = router;