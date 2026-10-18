'use strict';
/** /api/staff */
const express = require('express');

const router = express.Router();
router.use(require('./session'));    // /verify /logout /session/validate /check-pin
router.use(require('./accounts'));   // /  /:id

module.exports = router;
