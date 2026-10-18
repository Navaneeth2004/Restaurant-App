'use strict';
/** /api/reports (admin only) */
const express = require('express');
const access = require('../middleware/access');
const { offsetFromQuery } = require('../lib/local-time');
const today = require('../services/reports/today');
const trends = require('../services/reports/trends');

const router = express.Router();

router.get('/today', access.admin, (req, res) => res.json(today.today(offsetFromQuery(req))));
router.get('/history', access.admin, (req, res) => res.json(trends.history(req.query, offsetFromQuery(req))));
router.get('/revenue', access.admin, (req, res) => res.json(trends.revenueChart(offsetFromQuery(req))));

module.exports = router;
