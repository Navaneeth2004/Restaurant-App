'use strict';
/** /api/export (admin) */
const express = require('express');

const router = express.Router();
router.use(require('./menu'));
router.use(require('./revenue'));
router.use(require('./gst'));

module.exports = router;
