'use strict';
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const { handle, fail } = require('../../lib/http');
const { limitParam } = require('../../lib/input');
const orders = require('../../repositories/orders/orders.repo');

const router = express.Router();

// the kitchen screen reads this one (and the admin floor view)
router.get('/active', access.any, feature.of('kitchen', 'admin.floor'), (req, res) => res.json(orders.listActive()));

router.get('/table/:tableId/all', access.floor, feature.of('waiter', 'admin.floor'), (req, res) => {
  const sessionId = orders.latestSessionId(req.params.tableId);
  res.json(sessionId ? orders.sessionOrders(req.params.tableId, sessionId) : []);
});

router.get('/table/:tableId', access.floor, feature.of('waiter', 'admin.floor'), (req, res) => {
  const row = orders.activeForTable(req.params.tableId) || orders.lastDeliveredForTable(req.params.tableId);
  res.json(row ? orders.withItems(row.id) : null);
});

router.get('/history', access.floor, feature.of('reports.history'), (req, res) => res.json(orders.history(limitParam(req.query.limit, 100, 1000))));

router.get('/:id', access.floor, feature.of('waiter', 'admin.floor'), handle((req, res) => {
  const order = orders.withItems(req.params.id);
  if (!order) fail(404, 'Not found');
  res.json(order);
}));

module.exports = router;
