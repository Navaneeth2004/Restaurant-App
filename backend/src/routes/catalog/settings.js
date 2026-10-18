'use strict';
const express = require('express');
const access = require('../../middleware/access');
const { handle } = require('../../lib/http');
const settings = require('../../services/catalog/settings');
const { makeUploader } = require('../../services/files/uploader');

const router = express.Router();
const upload = makeUploader('logo', 2);

// readable before the PIN is entered (branding for the PIN screen) and by the kitchen screen
router.get('/', access.device, (req, res) => res.json(settings.listForClient()));

router.put('/', access.admin, handle((req, res) => {
  const accepted = settings.update(req.body);
  req.io.emit('settings_updated', accepted);
  res.json({ success: true });
}));

router.post('/logo', access.admin, upload.single('logo'), handle((req, res) => {
  const url = settings.setLogo(req.restaurantId, req.file);
  req.io.emit('settings_updated', { logo_url: url });
  res.json({ logo_url: url });
}));

module.exports = router;
