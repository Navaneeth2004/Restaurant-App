'use strict';
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const { handle } = require('../../lib/http');
const { updatePayment } = require('../../services/orders/payment-update');

const router = express.Router();

router.patch('/:id/payment', access.admin, feature.of('orders.payment_edit'), handle((req, res) => {
  const { audit, ...result } = updatePayment(req.params.id, req.body || {});
  res.locals.audit = { detail: audit };      // before/after values go to the audit log, not to the client
  res.json(result);
}));

module.exports = router;
