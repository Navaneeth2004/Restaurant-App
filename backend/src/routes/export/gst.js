'use strict';
/** GST filing exports: GSTR-1 (preview + portal JSON), GSTR-3B, GSTR-9. */
const express = require('express');
const access = require('../../middleware/access');
const adminLock = require('../../middleware/admin-lock');
const feature = require('../../middleware/feature');
const { offsetFromQuery } = require('../../lib/local-time');
const { loadRange } = require('../../services/billing/gst-data');
const gstr1 = require('../../services/billing/gstr1');
const gstr3b = require('../../services/billing/gstr3b');
const gstr9 = require('../../services/billing/gstr9');

const router = express.Router();
const range = (req) => loadRange({ from: req.query.from, to: req.query.to, offset: offsetFromQuery(req) });

router.get('/gst/gstr1/preview', access.admin, feature.of('export.gstr1'), adminLock.guard, (req, res) => res.json(gstr1.preview(range(req))));

router.get('/gst/gstr1', access.admin, feature.of('export.gstr1'), adminLock.guard, (req, res) => {
  const d = range(req);
  const json = gstr1.portalJson(d);
  const label = req.query.from ? `${d.dateFrom}_to_${d.dateTo}` : gstr1.returnPeriod(d.dateTo);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="GSTR1_${label}.json"`);
  res.json(json);
});

router.get('/gst/gstr3b', access.admin, feature.of('export.gstr3b'), adminLock.guard, (req, res) => res.json(gstr3b.build(range(req))));
router.get('/gst/gstr9', access.admin, feature.of('export.gstr9'), adminLock.guard, (req, res) => res.json(gstr9.build({ fy: req.query.fy, offset: offsetFromQuery(req) })));

module.exports = router;
