'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const files = require('../core/files');

const upload = files.makeUploader('logo', 2);

// Never sent to the browser, never writable through this route
const SECRET_KEYS = new Set(['gdrive_credentials', 'gdrive_tokens']);

// GET all (non-secret) settings
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.filter(r => !SECRET_KEYS.has(r.key)).map(r => [r.key, r.value]));
  res.json(settings);
});

// PUT update settings (admin only — enforced by middleware/auth.js)
router.put('/', (req, res) => {
  const update = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const body = req.body || {};
  db.transaction((data) => {
    for (const [key, value] of Object.entries(data)) {
      if (SECRET_KEYS.has(key)) continue;
      update.run(String(key).slice(0, 60), String(value).slice(0, 5000));
    }
  })(body);

  const safe = Object.fromEntries(Object.entries(body).filter(([k]) => !SECRET_KEYS.has(k)));
  req.io.emit('settings_updated', safe);
  res.json({ success: true });
});

// POST upload logo
router.post('/logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const logoUrl = files.publicUrl(req.restaurantId, req.file.filename);

  const old = db.prepare("SELECT value FROM settings WHERE key = 'logo_url'").get();
  if (old && old.value) files.removeUpload(req.restaurantId, old.value);

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('logo_url', logoUrl);
  req.io.emit('settings_updated', { logo_url: logoUrl });
  res.json({ logo_url: logoUrl });
});

router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 2 MB).' : err.message });
  next();
});

module.exports = router;