'use strict';
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const { handle } = require('../../lib/http');
const { cancelItem, cancelRound } = require('../../services/orders/cancel');
const { deliver } = require('../../services/orders/deliver');
const { closeSession } = require('../../services/orders/close-session');
const events = require('../../realtime/order-events');

const router = express.Router();

router.patch('/:id/cancel-item', access.floor, feature.of('waiter'), handle((req, res) => {
  const result = cancelItem(req.params.id, (req.body || {}).item_id);
  events.itemCancelled(req.io, req.params.id, result);
  res.json(result.updatedOrder || { success: true });
}));

router.patch('/:id/cancel', access.floor, feature.of('waiter'), handle((req, res) => {
  const result = cancelRound(req.params.id);
  events.roundCancelled(req.io, req.params.id, result);
  res.json({ success: true });
}));

// kitchen marks an order delivered (the waiter's "generate bill" also delivers a round that is still in the kitchen)
router.patch('/:id/deliver', access.any, feature.of('kitchen', 'waiter'), handle((req, res) => {
  const updated = deliver(req.params.id);
  events.orderDelivered(req.io, updated);
  res.json(updated);
}));

router.patch('/:id/close', access.floor, feature.of('waiter'), handle((req, res) => {
  const result = closeSession(req.params.id, req.body || {});
  if (result.alreadyClosed) return res.json({ success: true, note: 'Order was already closed by another device.' });
  // every round that was closed is announced, so kitchen screens and customer phones drop all of them
  result.closedIds.forEach(id => events.orderClosed(req.io, id, result.tableId));
  events.tablesChanged(req.io);
  return res.json({ success: true });
}));

module.exports = router;
