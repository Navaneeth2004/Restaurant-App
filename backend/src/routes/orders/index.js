'use strict';
/** /api/orders */
const express = require('express');

const router = express.Router();
router.use(require('./read'));
router.use(require('./submit'));
router.use(require('./lifecycle'));
router.use(require('./payment'));
router.use(require('./records'));

module.exports = router;
