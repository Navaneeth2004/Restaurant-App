'use strict';
/** /api/bug-report — support tickets go to the root console. */
const express = require('express');
const access = require('../middleware/access');
const ctx = require('../db/context');
const { handle, clientMeta } = require('../lib/http');
const { limit } = require('../middleware/rate-limit');
const tickets = require('../services/support/tickets');

const router = express.Router();

const sendLimit = limit({
  windowMs: 60 * 60 * 1000, max: 10, message: 'You have sent several reports in the last hour. Please wait a little.',
  key: (req) => `t:${ctx.get().device ? ctx.get().device.id : req.ip}`,
});

// any logged-in staff member (the kitchen too)
router.post('/', access.any, sendLimit, handle((req, res) => {
  res.status(201).json(tickets.create(req.body || {}, ctx.get(), clientMeta(req)));
}));

router.get('/', access.admin, (req, res) => res.json(tickets.listForRestaurant(ctx.get().restaurantId)));

module.exports = router;
