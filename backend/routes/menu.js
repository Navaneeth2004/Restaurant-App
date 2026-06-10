'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

// Migration: add sort_order to menu_items if missing.
// We use the low-level _raw.run so it happens in-memory immediately,
// then call save() via db.exec of a no-op to flush the schema.
(function migrate() {
  try {
    // Check if column exists first to avoid a pointless error
    const cols = db.prepare("PRAGMA table_info(menu_items)").all();
    const hasSortOrder = cols.some(c => c.name === 'sort_order');
    if (!hasSortOrder) {
      db.exec('ALTER TABLE menu_items ADD COLUMN sort_order INTEGER DEFAULT 0');
      db.exec('UPDATE menu_items SET sort_order = id');
    }
  } catch (e) {
    // Already exists or PRAGMA failed — safe to ignore
  }
})();

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `item_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  }
});

// Helper: check if sort_order column actually exists in the live schema
function hasSortOrderCol() {
  try {
    const cols = db.prepare("PRAGMA table_info(menu_items)").all();
    return cols.some(c => c.name === 'sort_order');
  } catch { return false; }
}

router.get('/', (req, res) => {
  try {
    let items;
    if (hasSortOrderCol()) {
      items = db.prepare(`
        SELECT m.*, c.name as category_name
        FROM menu_items m
        JOIN categories c ON m.category_id = c.id
        ORDER BY c.sort_order, m.sort_order, m.id
      `).all();
    } else {
      items = db.prepare(`
        SELECT m.*, c.name as category_name
        FROM menu_items m
        JOIN categories c ON m.category_id = c.id
        ORDER BY c.sort_order, m.id
      `).all();
    }
    res.json(items);
  } catch (e) {
    console.error('[menu GET /]', e.message);
    // Final fallback — no sort_order at all
    try {
      const items = db.prepare(`
        SELECT m.*, c.name as category_name
        FROM menu_items m
        JOIN categories c ON m.category_id = c.id
        ORDER BY c.sort_order, m.id
      `).all();
      res.json(items);
    } catch (e2) {
      res.status(500).json({ error: e2.message });
    }
  }
});

router.get('/category/:catId', (req, res) => {
  try {
    let items;
    if (hasSortOrderCol()) {
      items = db.prepare(`
        SELECT m.*, c.name as category_name
        FROM menu_items m
        JOIN categories c ON m.category_id = c.id
        WHERE m.category_id = ?
        ORDER BY m.sort_order, m.id
      `).all(req.params.catId);
    } else {
      items = db.prepare(`
        SELECT m.*, c.name as category_name
        FROM menu_items m
        JOIN categories c ON m.category_id = c.id
        WHERE m.category_id = ?
        ORDER BY m.id
      `).all(req.params.catId);
    }
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', upload.single('image'), (req, res) => {
  const { name, description, price, category_id } = req.body;
  if (!name || !price || !category_id) return res.status(400).json({ error: 'name, price, category_id required' });
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    let info;
    if (hasSortOrderCol()) {
      const maxRow = db.prepare('SELECT MAX(sort_order) as m FROM menu_items WHERE category_id = ?').get(parseInt(category_id));
      const maxOrder = (maxRow?.m ?? 0);
      info = db.prepare(
        'INSERT INTO menu_items (name, description, price, category_id, image_path, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(name.trim(), description || '', parseFloat(price), parseInt(category_id), imagePath, maxOrder + 1);
    } else {
      info = db.prepare(
        'INSERT INTO menu_items (name, description, price, category_id, image_path) VALUES (?, ?, ?, ?, ?)'
      ).run(name.trim(), description || '', parseFloat(price), parseInt(category_id), imagePath);
    }
    const item = db.prepare('SELECT m.*, c.name as category_name FROM menu_items m JOIN categories c ON m.category_id = c.id WHERE m.id = ?').get(info.lastInsertRowid);
    req.io.emit('menu_updated');
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', upload.single('image'), (req, res) => {
  const { name, description, price, category_id, available } = req.body;
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  let imagePath = existing.image_path;
  if (req.file) {
    if (existing.image_path) {
      const oldPath = path.join(__dirname, '../..', existing.image_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    imagePath = `/uploads/${req.file.filename}`;
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
    description ?? null,
    price ? parseFloat(price) : null,
    category_id ? parseInt(category_id) : null,
    imagePath,
    available !== undefined ? (available === 'true' || available === true ? 1 : 0) : null,
    req.params.id
  );

  const item = db.prepare('SELECT m.*, c.name as category_name FROM menu_items m JOIN categories c ON m.category_id = c.id WHERE m.id = ?').get(req.params.id);
  req.io.emit('menu_updated');
  res.json(item);
});

// PATCH reorder menu items
router.patch('/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
  if (!hasSortOrderCol()) return res.json({ success: true }); // column not ready yet, skip silently
  try {
    const upd = db.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?');
    const reorder = db.transaction(() => { order.forEach(({ id, sort_order }) => upd.run(sort_order, id)); });
    reorder();
    req.io.emit('menu_updated');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const inUse = db.prepare(`
    SELECT oi.id FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.menu_item_id = ?
      AND o.status IN ('active', 'delivered')
    LIMIT 1
  `).get(req.params.id);
  if (inUse) {
    return res.status(400).json({ error: 'This item is part of an active or pending order. Cannot delete until those orders are closed.' });
  }

  if (item.image_path) {
    const imgPath = path.join(__dirname, '../..', item.image_path);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  req.io.emit('menu_updated');
  res.json({ success: true });
});

module.exports = router;