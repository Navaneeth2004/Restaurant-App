'use strict';
/**
 * /api/kiosk — customer QR pages (no login; the token identifies the table) plus two staff helpers
 * (/lan-ip, /ensure-token) used to build the QR code.
 */
const express = require('express');
const cfg = require('../config/env');
const access = require('../middleware/access');
const { handle, fail } = require('../lib/http');
const { limit } = require('../middleware/rate-limit');
const kioskAccess = require('../services/kiosk/access');
const view = require('../services/kiosk/view');
const actions = require('../services/kiosk/actions');
const events = require('../realtime/order-events');

const router = express.Router();
const orderLimit = limit({ windowMs: 60 * 1000, max: 20, message: 'Too many orders from this network. Please wait a moment.' });
const billLimit = limit({ windowMs: 60 * 1000, max: 10, message: 'Please wait a moment before asking again.' });
const tableOf = (req) => kioskAccess.requireTable(req.params.token);

// staff helpers (declared first so they are not mistaken for a token)
router.get('/lan-ip', access.floor, (req, res) => res.json({ ip: cfg.DEPLOYMENT === 'local' ? kioskAccess.lanIp() : null }));
router.post('/ensure-token', access.floor, handle((req, res) => {
  const { table_id } = req.body || {};
  if (!table_id) fail(400, 'table_id required');
  res.json({ token: kioskAccess.ensureToken(req.restaurantId, table_id) });
}));

// customer pages
router.get('/:token', access.public, handle((req, res) => res.json(view.tableInfo(tableOf(req)))));
router.get('/:token/menu', access.public, handle((req, res) => { tableOf(req); res.json(view.menuForCustomer()); }));
router.get('/:token/orders', access.public, handle((req, res) => res.json(view.tableOrders(tableOf(req)))));

router.post('/:token/order', access.public, orderLimit, handle((req, res) => {
  const result = actions.placeOrder(tableOf(req), req.body || {});
  events.orderSubmitted(req.io, result);
  res.status(result.isNew ? 201 : 200).json(result.order);
}));

router.post('/:token/bill', access.public, billLimit, handle((req, res) => {
  const table = tableOf(req);
  actions.requestBill(table, req.body || {}).forEach(order => events.orderDelivered(req.io, order));
  events.tablesChanged(req.io);
  events.billRequested(req.io, table);
  res.json({ success: true, message: 'Bill requested. Your waiter will be with you shortly.' });
}));

module.exports = router;
