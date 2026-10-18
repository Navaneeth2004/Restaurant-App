'use strict';
const express = require('express');
const access = require('../../middleware/access');
const { handle } = require('../../lib/http');
const { cancelItem, cancelRound } = require('../../services/orders/cancel');
const { deliver } = require('../../services/orders/deliver');
const { closeSession } = require('../../services/orders/close-session');
const events = require('../../realtime/order-events');

const router = express.Router();

router.patch('/:id/cancel-item', access.floor, handle((req, res) => {
  const result = cancelItem(req.params.id, (req.body || {}).item_id);
  events.itemCancelled(req.io, req.params.id, result);
  res.json(result.updatedOrder || { success: true });
}));

router.patch('/:id/cancel', access.floor, handle((req, res) => {
  const result = cancelRound(req.params.id);
  events.roundCancelled(req.io, req.params.id, result);
  res.json({ success: true });
}));

// kitchen marks an order delivered
router.patch('/:id/deliver', access.any, handle((req, res) => {
  const updated = deliver(req.params.id);
  events.orderDelivered(req.io, updated);
  res.json(updated);
}));

router.patch('/:id/close', access.floor, handle((req, res) => {
  const result = closeSession(req.params.id, req.body || {});
  if (result.alreadyClosed) return res.json({ success: true, note: 'Order was already closed by another device.' });
  events.billClosed(req.io, req.params.id, result.tableId);
  return res.json({ success: true });
}));

module.exports = router;
