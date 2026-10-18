'use strict';
/**
 * /api/backup (admin only): download / restore THIS restaurant as a zip (restaurant.db + uploads/).
 * Google Drive and server-folder backups are not offered in the cloud version; back up DATA_DIR on the server.
 */
const express = require('express');
const access = require('../middleware/access');
const { handle, fail } = require('../lib/http');
const { createBackupArchive } = require('../services/backup/snapshot');
const { restoreFromZip } = require('../services/backup/restore');
const { makeMemoryUploader, isZip } = require('../services/files/uploader');

const router = express.Router();
const upload = makeMemoryUploader(60, isZip, 'ZIP files only');

router.get('/info', access.admin, (req, res) => res.json({ mode: 'cloud', manual: true, local: false, drive: false }));

router.get('/download', access.admin, handle(async (req, res) => {
  const { filename, archive } = await createBackupArchive(req.restaurantId);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  archive.on('error', (e) => { console.error('[Backup]', e.message); res.end(); });
  archive.pipe(res);
}));

router.post('/restore', access.admin, upload.single('backup'), handle((req, res) => {
  if (!req.file) fail(400, 'No file uploaded');
  const { imagesRestored } = restoreFromZip(req.restaurantId, req.file.buffer);
  ['tables_updated', 'menu_updated', 'categories_updated'].forEach(e => req.io.emit(e));
  res.json({ success: true, message: `Restored. ${imagesRestored} images restored. Everyone must log in again.`, images_restored: imagesRestored });
}));

module.exports = router;
