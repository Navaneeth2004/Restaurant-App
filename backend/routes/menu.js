const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

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

router.get('/', (req, res) => {
  const items = db.prepare(`
    SELECT m.*, c.name as category_name 
    FROM menu_items m 
    JOIN categories c ON m.category_id = c.id 
    ORDER BY c.sort_order, m.name
  `).all();
  res.json(items);
});

router.get('/category/:catId', (req, res) => {
  const items = db.prepare(`
    SELECT m.*, c.name as category_name 
    FROM menu_items m 
    JOIN categories c ON m.category_id = c.id 
    WHERE m.category_id = ? 
    ORDER BY m.name
  `).all(req.params.catId);
  res.json(items);
});

router.post('/', upload.single('image'), (req, res) => {
  const { name, description, price, category_id } = req.body;
  if (!name || !price || !category_id) return res.status(400).json({ error: 'name, price, category_id required' });
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const info = db.prepare(
    'INSERT INTO menu_items (name, description, price, category_id, image_path) VALUES (?, ?, ?, ?, ?)'
  ).run(name.trim(), description || '', parseFloat(price), parseInt(category_id), imagePath);
  const item = db.prepare('SELECT m.*, c.name as category_name FROM menu_items m JOIN categories c ON m.category_id = c.id WHERE m.id = ?').get(info.lastInsertRowid);
  req.io.emit('menu_updated');
  res.status(201).json(item);
});

router.put('/:id', upload.single('image'), (req, res) => {
  const { name, description, price, category_id, available } = req.body;
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  let imagePath = existing.image_path;
  if (req.file) {
    // Delete old image if exists
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

router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  // Block delete if item is in any active or delivered (unbilled) order
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