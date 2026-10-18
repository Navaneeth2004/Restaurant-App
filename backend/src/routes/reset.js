'use strict';
/** POST /api/reset  Body: { confirm: "RESET EVERYTHING" }  (admin only) — wipes THIS restaurant only. */
const express = require('express');
const access = require('../middleware/access');
const { handle } = require('../lib/http');
const { factoryReset } = require('../services/catalog/reset');
const { DEFAULT_SETTINGS } = require('../config/defaults');

const router = express.Router();

router.post('/', access.admin, handle((req, res) => {
  const message = factoryReset(req.restaurantId, (req.body || {}).confirm);
  const { brand_color, logo_url, tax_percent, currency_symbol, kitchen_overdue_mins, admin_lock_config } = DEFAULT_SETTINGS;
  ['tables_updated', 'menu_updated', 'categories_updated'].forEach(e => req.io.emit(e));
  req.io.emit('settings_updated', { brand_color, logo_url, tax_percent, currency_symbol, kitchen_overdue_mins, admin_lock_config });
  console.log(`[Reset] Factory reset performed for restaurant ${req.restaurantId}`);
  res.json({ success: true, message });
}));

module.exports = router;
