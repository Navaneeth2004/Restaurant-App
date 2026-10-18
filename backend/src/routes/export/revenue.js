'use strict';
const express = require('express');
const access = require('../../middleware/access');
const { offsetFromQuery } = require('../../lib/local-time');
const revenue = require('../../services/billing/revenue-data');
const { toCsv } = require('../../services/billing/revenue-csv');
const { toJson } = require('../../services/billing/revenue-json');

const router = express.Router();

router.get('/revenue', access.admin, (req, res) => {
  const report = revenue.build({ from: req.query.from, to: req.query.to, offset: offsetFromQuery(req) });
  const range = `${report.period.from}_to_${report.period.to}`;
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="revenue_report_${req.query.from ? range : 'all'}.csv"`);
    return res.send(toCsv(report));
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="revenue_report_${range}.json"`);
  return res.json(toJson(report));
});

module.exports = router;
