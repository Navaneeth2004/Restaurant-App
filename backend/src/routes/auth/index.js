'use strict';
/** /api/auth — owner login, device linking, pairing codes, device list. */
const express = require('express');
const cfg = require('../../config/env');
const access = require('../../middleware/access');

const router = express.Router();

router.get('/config', access.public, (req, res) => {
  res.json({ registration_open: cfg.ALLOW_REGISTRATION, methods: cfg.AUTH_METHODS });
});
router.use(require('./owner'));
router.use(require('./device'));
router.use(require('./admin'));

module.exports = router;
