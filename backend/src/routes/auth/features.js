'use strict';
/** Which switchable features are OFF for this device's restaurant (the app hides them; the server refuses them too). */
const express = require('express');
const access = require('../../middleware/access');
const ctx = require('../../db/context');
const { disabledFor } = require('../../services/features/resolve');

const router = express.Router();

router.get('/features', access.device, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ disabled: disabledFor(ctx.get().restaurant) });
});

module.exports = router;
