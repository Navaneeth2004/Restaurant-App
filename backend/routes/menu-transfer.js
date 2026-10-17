'use strict';
/**
 * /api/export/menu  and  /api/export/menu/import   (admin only)
 * Menu backup/move: a zip with menu.json + images/. Mounted BEFORE routes/export.js so it takes over those two
 * URLs (the GST routes in export.js are untouched). Works with the per-restaurant database and photo folders.
 */
const express = require('express');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const db = require('../db/database');
const ctx = require('../core/context');
const files = require('../core/files');

const router = express.Router();
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /zip/.test(file.mimetype) || /\.zip$/i.test(file.originalname);
    ok ? cb(null, true) : cb(new Error('ZIP files only'));
  },
});

const MAX_CATEGORIES = 200, MAX_ITEMS = 5000, MAX_ENTRIES = 6000, MAX_IMAGE = 5 * 1024 * 1024;
const text = (v, n) => String(v === undefined || v === null ? '' : v).trim().slice(0, n);

// ── EXPORT ────────────────────────────────────────────────────────────────
router.get('/menu', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  const items = db.prepare(`
    SELECT m.*, c.name AS category_name FROM menu_items m JOIN categories c ON m.category_id = c.id
    ORDER BY c.sort_order, m.sort_order, m.id`).all();

  const payload = JSON.stringify({
    exported_at: new Date().toISOString(),
    version: 2,
    categories: categories.map(c => ({ name: c.name, sort_order: c.sort_order })),
    items: items.map(i => ({
      name: i.name, description: i.description, price: i.price, category_name: i.category_name,
      available: i.available, sort_order: i.sort_order, image_path: i.image_path,
    })),
  }, null, 2);

  const imageFiles = items.filter(i => i.image_path)
    .map(i => ({ disk: files.resolveUpload(req.restaurantId, i.image_path), zip: `images/${path.basename(i.image_path)}` }))
    .filter(f => f.disk && fs.existsSync(f.disk));

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="menu_export_${new Date().toISOString().slice(0, 10)}.zip"`);
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', e => { console.error('[menu export]', e.message); res.end(); });
  archive.pipe(res);
  archive.append(payload, { name: 'menu.json' });
  imageFiles.forEach(f => archive.file(f.disk, { name: f.zip }));
  archive.finalize();
});

// ── IMPORT ────────────────────────────────────────────────────────────────
router.post('/menu/import', (req, res, next) => {
  const done = (e) => (req._ctx ? ctx.run(req._ctx, () => next(e)) : next(e));
  if ((req.headers['content-type'] || '').includes('multipart/form-data')) zipUpload.single('menuzip')(req, res, done);
  else express.json({ limit: '2mb' })(req, res, done);
}, (req, res) => {
  try {
    const rid = req.restaurantId;
    let categories, items, imagesImported = 0;
    const imageMap = {};

    if (req.file) {
      let zip;
      try { zip = new AdmZip(req.file.buffer); } catch (_) { return res.status(400).json({ error: 'That is not a valid menu file.' }); }
      const entries = zip.getEntries();
      if (entries.length > MAX_ENTRIES) return res.status(400).json({ error: 'The file has too many entries.' });
      const jsonEntry = zip.getEntry('menu.json');
      if (!jsonEntry) return res.status(400).json({ error: 'ZIP must contain menu.json' });
      let parsed;
      try { parsed = JSON.parse(jsonEntry.getData().toString('utf8')); } catch (_) { return res.status(400).json({ error: 'menu.json is not valid.' }); }
      categories = parsed.categories; items = parsed.items;

      for (const entry of entries) {
        if (entry.isDirectory || !entry.entryName.startsWith('images/')) continue;
        const original = path.basename(entry.entryName);
        if (!files.isAllowedName(original) || entry.header.size > MAX_IMAGE) continue;
        const stored = files.newName('item', path.extname(original));      // never overwrite an existing photo
        fs.writeFileSync(path.join(files.uploadsDir(rid), stored), entry.getData());
        imagesImported++;
        imageMap[original] = files.publicUrl(rid, stored);
      }
    } else {
      categories = req.body && req.body.categories; items = req.body && req.body.items;
    }

    if (!Array.isArray(categories) || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid menu file — missing categories or items.' });
    if (categories.length > MAX_CATEGORIES || items.length > MAX_ITEMS) return res.status(400).json({ error: 'The menu file is too large.' });

    const results = { categories_added: 0, items_added: 0, items_skipped: 0, images_imported: imagesImported };

    db.transaction(() => {
      const catMap = {};
      db.prepare('SELECT id, name FROM categories').all().forEach(c => { catMap[c.name.toLowerCase()] = c.id; });
      let catOrder = db.prepare('SELECT MAX(sort_order) AS m FROM categories').get().m || 0;
      const insertCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
      for (const c of categories) {
        const name = text(c && c.name, 60);
        if (!name || catMap[name.toLowerCase()]) continue;
        catMap[name.toLowerCase()] = insertCat.run(name, ++catOrder).lastInsertRowid;
        results.categories_added++;
      }

      const insertItem = db.prepare('INSERT INTO menu_items (name, description, price, category_id, available, image_path, sort_order) VALUES (?,?,?,?,?,?,?)');
      const exists = db.prepare('SELECT id FROM menu_items WHERE LOWER(name) = ? AND category_id = ?');
      const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM menu_items WHERE category_id = ?');
      for (const item of items) {
        const name = text(item && item.name, 80);
        const price = Number(item && item.price);
        const catId = catMap[text(item && item.category_name, 60).toLowerCase()];
        if (!name || !Number.isFinite(price) || price < 0 || !catId || exists.get(name.toLowerCase(), catId)) { results.items_skipped++; continue; }
        const image = item.image_path ? (imageMap[path.basename(String(item.image_path))] || null) : null;
        const order = (maxOrder.get(catId).m || catId * 10000) + 1;
        insertItem.run(name, text(item.description, 500), price, catId, item.available ? 1 : 0, image, order);
        results.items_added++;
      }
    })();

    req.io.emit('menu_updated');
    req.io.emit('categories_updated');
    res.json({ success: true, ...results });
  } catch (e) {
    console.error('[menu import]', e.message);
    res.status(500).json({ error: 'Import failed.' });
  }
});

router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : err.message });
  next();
});

module.exports = router;