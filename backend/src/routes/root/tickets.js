'use strict';
/** Root console: support tickets. */
const express = require('express');
const access = require('../../middleware/access');
const { handle } = require('../../lib/http');
const tickets = require('../../services/support/tickets');
const audit = require('../../services/root/audit');
const restaurantsRepo = require('../../repositories/central/restaurants.repo');
const { actorOf } = require('./helpers');

const router = express.Router();
const idOf = (req) => parseInt(req.params.id, 10);

const restaurantBrief = (id) => {
  const r = restaurantsRepo.byId(id);
  return r ? { id: r.id, name: r.name, status: r.status, plan: r.plan } : null;
};

router.get('/tickets', access.root, (req, res) => res.json(tickets.rootList(req.query)));
router.get('/tickets/:id', access.root, handle((req, res) => res.json(tickets.rootGet(idOf(req), restaurantBrief))));

router.get('/tickets/:id/screenshot', access.root, (req, res) => {
  const file = tickets.screenshotPath(idOf(req));
  if (!file) return res.status(404).end();
  res.set('Content-Security-Policy', "default-src 'none'; sandbox");
  res.set('X-Content-Type-Options', 'nosniff');
  return res.sendFile(file);
});

router.patch('/tickets/:id', access.root, handle((req, res) => {
  const changed = tickets.rootUpdate(idOf(req), req.body);
  audit.record(actorOf(req), 'ticket.update', String(idOf(req)), changed);
  res.json({ success: true });
}));

module.exports = router;
