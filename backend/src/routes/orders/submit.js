'use strict';
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const { handle } = require('../../lib/http');
const idempotency = require('../../lib/idempotency');
const { submitOrder } = require('../../services/orders/submit-order');
const { directBill } = require('../../services/orders/direct-bill');
const events = require('../../realtime/order-events');

const router = express.Router();

// Send to kitchen. `items` is ADDITIVE: only this device's new items (see services/orders/submit-order.js).
// `request_id` makes a retry after a timeout harmless: the same id is answered from memory, not applied twice.
router.post('/', access.floor, feature.of('waiter'), handle((req, res) => {
  const { table_id, items, request_id } = req.body || {};
  const seen = idempotency.get(req.restaurantId, request_id);
  if (seen) return res.status(200).json(seen);
  const result = submitOrder({ tableId: table_id, items, source: 'staff' });
  events.orderSubmitted(req.io, result);
  idempotency.set(req.restaurantId, request_id, result.order);
  return res.status(result.isNew ? 201 : 200).json(result.order);
}));

router.post('/direct-bill', access.floor, feature.of('waiter'), handle((req, res) => {
  const { table_id, items, request_id } = req.body || {};
  const seen = idempotency.get(req.restaurantId, request_id);
  if (seen) return res.status(200).json(seen);
  const order = directBill({ tableId: table_id, items });
  events.tablesChanged(req.io);
  idempotency.set(req.restaurantId, request_id, order);
  return res.status(201).json(order);
}));

module.exports = router;
