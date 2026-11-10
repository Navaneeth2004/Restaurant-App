'use strict';
/** The restaurant's own subscription and the plans it could choose (admin only, read-only). */
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const { subscriptionInfo } = require('../../services/restaurants/subscription-info');

const router = express.Router();

router.get('/subscription', access.admin, feature.of('admin.restaurant'), (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(subscriptionInfo());
});

module.exports = router;