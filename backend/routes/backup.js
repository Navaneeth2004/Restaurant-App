'use strict';
/**
 * /api/backup  (admin only)
 *   GET  /info        what this deployment supports (the Backup screen uses it to hide unsupported tabs)
 *   GET  /download    zip of THIS restaurant: restaurant.db + uploads/
 *   POST /restore     replace THIS restaurant's data from such a zip
 *
 * Google Drive and "save to a folder on the server" backups are intentionally not offered in the cloud
 * version: the server's disk is not the customer's PC, and every restaurant would need its own Google
 * Cloud project. Server-side backups of DATA_DIR are done by you (see CLOUD_BATCH2.md).
 */
const express = require('express');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const ctx = require('../core/context');
const tenants = require('../core/tenants');
const files = require('../core/files');
const cfg = require('../core/config');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });

const MAX_ENTRIES = 3000;
const MAX_UNCOMPRESSED = 300 * 1024 * 1024;
const REQUIRED_TABLES = ['settings', 'categories', 'menu_items', 'tables', 'orders', 'order_items', 'staff'];

router.get('/info', (req, res) => {
  res.json({ mode: 'cloud', manual: true, local: false, drive: false });
});

router.get('/download', async (req, res) => {
  const rid = req.restaurantId;
  const tmp = path.join(os.tmpdir(), `pos_${rid}_${Date.now()}.db`);
  try {
    // consistent snapshot of the live database (safe while orders are being taken)
    await tenants.get(rid).raw.backup(tmp);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="pos_backup_${stamp}.zip"`);

    const arch = archiver('zip', { zlib: { level: 6 } });
    arch.on('error', e => { console.error('[Backup]', e.message); res.end(); });
    res.on('close', () => { try { fs.unlinkSync(tmp); } catch (_) {} });
    arch.pipe(res);
    arch.file(tmp, { name: 'restaurant.db' });
    arch.directory(files.uploadsDir(rid), 'uploads');
    arch.finalize();
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    console.error('[Backup] download failed:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'Backup failed' });
  }
});

router.post('/restore', ctx.wrap(upload.single('backup')), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const rid = req.restaurantId;
  const stage = path.join(os.tmpdir(), `pos_restore_${rid}_${Date.now()}.db`);

  try {
    let zip;
    try { zip = new AdmZip(req.file.buffer); } catch (_) { return res.status(400).json({ error: 'That is not a valid backup file.' }); }

    const entries = zip.getEntries();
    if (entries.length > MAX_ENTRIES) return res.status(400).json({ error: 'Backup has too many files.' });
    const total = entries.reduce((s, e) => s + (e.header.size || 0), 0);
    if (total > MAX_UNCOMPRESSED) return res.status(400).json({ error: 'Backup is too large.' });

    const dbEntry = zip.getEntry('restaurant.db');
    if (!dbEntry) return res.status(400).json({ error: 'Invalid backup — restaurant.db not found' });
    fs.writeFileSync(stage, dbEntry.getData());

    // validate before touching anything live
    const probe = new Database(stage, { readonly: true });
    let ok = false;
    try {
      const have = probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name);
      ok = REQUIRED_TABLES.every(t => have.includes(t)) &&
           probe.prepare("SELECT COUNT(*) AS c FROM staff WHERE role = 'admin' AND active = 1").get().c > 0;
    } catch (_) { ok = false; } finally { probe.close(); }
    if (!ok) return res.status(400).json({ error: 'Invalid backup — this does not look like a POS backup.' });

    // swap the database file
    const row = require('../core/central').prepare('SELECT db_file FROM restaurants WHERE id = ?').get(rid);
    const target = path.join(cfg.TENANT_DIR, row.db_file);
    tenants.close(rid);
    for (const suffix of ['-wal', '-shm']) { try { fs.unlinkSync(target + suffix); } catch (_) {} }
    fs.copyFileSync(stage, target);

    // reopen (runs any newer migrations) and tidy
    const h = tenants.get(rid);
    h.raw.prepare("UPDATE tables SET kiosk_token = NULL WHERE kiosk_token IS NOT NULL AND kiosk_token NOT LIKE ?").run(`${rid}%`);
    h.raw.prepare('DELETE FROM staff_sessions').run();

    // photos
    const dir = files.uploadsDir(rid);
    let restored = 0;
    for (const e of entries) {
      if (e.isDirectory || !e.entryName.startsWith('uploads/')) continue;
      const base = path.basename(e.entryName);
      if (!files.isAllowedName(base)) continue;
      fs.writeFileSync(path.join(dir, base), e.getData());
      restored++;
    }

    req.io.emit('tables_updated');
    req.io.emit('menu_updated');
    req.io.emit('categories_updated');
    res.json({ success: true, message: `Restored. ${restored} images restored. Everyone must log in again.`, images_restored: restored });
  } catch (e) {
    console.error('[Backup] restore failed:', e.message);
    res.status(500).json({ error: e.message || 'Restore failed' });
  } finally {
    try { fs.unlinkSync(stage); } catch (_) {}
  }
});

module.exports = router;