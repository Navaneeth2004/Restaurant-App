'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

// Migration runs lazily on first request via hasSortOrderCol()
// so the DB is guaranteed to be ready.

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

// One-time seed: run after DB is confirmed ready (called from GET /)
let _seeded = false;
function seedSortOrder() {
  if (_seeded) return;
  _seeded = true;
  try {
    const cols = db.prepare("PRAGMA table_info(menu_items)").all();
    if (!cols.some(c => c.name === 'sort_order')) {
      db.exec('ALTER TABLE menu_items ADD COLUMN sort_order INTEGER DEFAULT 0');
    }
    // BUG FIX: Only seed items whose sort_order is still 0 (never been manually set).
    // Previously ALL items were reseeded on every server start, wiping any custom
    // drag order the user had saved via PATCH /reorder.
    const items = db.prepare('SELECT id, category_id FROM menu_items WHERE sort_order = 0 ORDER BY category_id, id').all();
    if (items.length === 0) return; // nothing to seed — all items already have an order
    // Find the current max sort_order per category so new seeds don't collide
    // with already-ordered items in the same category.
    const maxRows = db.prepare('SELECT category_id, MAX(sort_order) as m FROM menu_items GROUP BY category_id').all();
    const posMap = {};
    for (const r of maxRows) posMap[r.category_id] = r.m ?? 0;
    const update = db.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?');
    const seedAll = db.transaction(() => {
      for (const row of items) {
        const pos = (posMap[row.category_id] ?? 0) + 1;
        posMap[row.category_id] = pos;
        update.run(row.category_id * 10000 + pos, row.id);
      }
    });
    seedAll();
  } catch (e) {
    console.warn('[menu seed]', e.message);
  }
}

// Helper: check if sort_order column actually exists in the live schema
function hasSortOrderCol() {
  try {
    const cols = db.prepare("PRAGMA table_info(menu_items)").all();
    return cols.some(c => c.name === 'sort_order');
  } catch { return false; }
}

router.get('/', (req, res) => {
  seedSortOrder();
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
// FIX: Does NOT emit 'menu_updated' — this prevents the socket event from
// triggering a reload in AdminMenu and reverting the optimistic reorder.
// The frontend updates state directly from the API response instead.
router.patch('/reorder', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }
  if (!hasSortOrderCol()) return res.json({ ok: true });
  try {
    const update = db.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?');
    const updateAll = db.transaction((rows) => {
      for (const { id, sort_order } of rows) {
        update.run(sort_order, id);
      }
    });
    updateAll(items);
    // NOTE: intentionally NOT emitting menu_updated here.
    // Emitting would cause AdminMenu's useSocket handler to call load(),
    // overwriting the freshly reordered state with the pre-reorder DB state
    // (race condition: the DB write may not have flushed to the read path yet).
    res.json({ ok: true });
  } catch (err) {
    console.error('Reorder failed:', err);
    res.status(500).json({ error: 'Reorder failed' });
  }
});

router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  // FIX: include 'billed_direct' — a direct-billed order can still be
  // open (not yet closed/paid), and deleting the item out from under it
  // would orphan the order_items row's menu_item_id reference.
  const inUse = db.prepare(`
    SELECT oi.id FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.menu_item_id = ?
      AND o.status IN ('active', 'delivered', 'billed_direct')
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