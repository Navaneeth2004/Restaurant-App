'use strict';
/** /api/reports (admin only) */
const express = require('express');
const access = require('../middleware/access');
const feature = require('../middleware/feature');
const { offsetFromQuery } = require('../lib/local-time');
const today = require('../services/reports/today');
const trends = require('../services/reports/trends');

const router = express.Router();

// the floor view reads today's numbers and the recent history too, so those two stay open while it is on
router.get('/today', access.admin, feature.of('reports.analytics', 'admin.floor'), (req, res) => res.json(today.today(offsetFromQuery(req))));
router.get('/history', access.admin, feature.of('reports.history', 'admin.floor'), (req, res) => res.json(trends.history(req.query, offsetFromQuery(req))));
router.get('/revenue', access.admin, feature.of('reports.analytics'), (req, res) => res.json(trends.revenueChart(offsetFromQuery(req))));

module.exports = router;
