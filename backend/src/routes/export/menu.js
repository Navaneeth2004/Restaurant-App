'use strict';
/** Menu backup/move (admin): zip with menu.json + images/. */
const express = require('express');
const access = require('../../middleware/access');
const { handle } = require('../../lib/http');
const { createMenuArchive } = require('../../services/backup/menu-export');
const { importMenu } = require('../../services/backup/menu-import');
const { makeMemoryUploader, isZip } = require('../../services/files/uploader');

const router = express.Router();
const upload = makeMemoryUploader(25, isZip, 'ZIP files only');

router.get('/menu', access.admin, (req, res) => {
  const { filename, archive } = createMenuArchive(req.restaurantId);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  archive.on('error', (e) => { console.error('[menu export]', e.message); res.end(); });
  archive.pipe(res);
});

// a zip upload (field "menuzip") or a plain JSON body
router.post('/menu/import', access.admin, upload.single('menuzip'), handle((req, res) => {
  const results = importMenu(req.restaurantId, req.file ? { buffer: req.file.buffer } : { body: req.body });
  req.io.emit('menu_updated');
  req.io.emit('categories_updated');
  res.json({ success: true, ...results });
}));

module.exports = router;
