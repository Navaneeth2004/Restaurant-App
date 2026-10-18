'use strict';
const express = require('express');
const access = require('../../middleware/access');
const { handle } = require('../../lib/http');
const { submitOrder } = require('../../services/orders/submit-order');
const { directBill } = require('../../services/orders/direct-bill');
const events = require('../../realtime/order-events');

const router = express.Router();

// Send to kitchen. `items` is ADDITIVE: only this device's new items (see services/orders/submit-order.js).
router.post('/', access.floor, handle((req, res) => {
  const { table_id, items } = req.body || {};
  const result = submitOrder({ tableId: table_id, items, source: 'staff' });
  events.orderSubmitted(req.io, result);
  res.status(result.isNew ? 201 : 200).json(result.order);
}));

router.post('/direct-bill', access.floor, handle((req, res) => {
  const { table_id, items } = req.body || {};
  const order = directBill({ tableId: table_id, items });
  events.tablesChanged(req.io);
  res.status(201).json(order);
}));

module.exports = router;
