'use strict';
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const { handle } = require('../../lib/http');
const { updatePayment } = require('../../services/orders/payment-update');

const router = express.Router();

router.patch('/:id/payment', access.admin, feature.of('orders.payment_edit'), handle((req, res) => res.json(updatePayment(req.params.id, req.body || {}))));

module.exports = router;
