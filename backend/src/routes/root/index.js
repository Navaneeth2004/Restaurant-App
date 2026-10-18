'use strict';
/** /api/root — the root console API (platform operator only). Authentication happens in middleware/gate/root-gate.js. */
const express = require('express');

const router = express.Router();
router.use(require('./auth'));
router.use(require('./overview'));
router.use(require('./restaurants'));
router.use(require('./actions'));
router.use(require('./tickets'));

module.exports = router;
