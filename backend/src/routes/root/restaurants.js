'use strict';
/** Root console: list / read / create / edit restaurants. */
const express = require('express');
const access = require('../../middleware/access');
const { handle } = require('../../lib/http');
const stats = require('../../services/restaurants/stats');
const { applyPatch } = require('../../services/restaurants/edit');
const { createForOwner } = require('../../services/root/create-restaurant');
const audit = require('../../services/root/audit');
const { actorOf, restaurantOr404 } = require('./helpers');
const restaurantsRepo = require('../../repositories/central/restaurants.repo');

const router = express.Router();

router.get('/restaurants', access.root, (req, res) => res.json(stats.listSummaries()));
router.get('/restaurants/:id', access.root, handle((req, res) => res.json(stats.detail(restaurantOr404(req)))));

router.post('/restaurants', access.root, handle(async (req, res) => {
  const created = await createForOwner(req.body || {});
  audit.record(actorOf(req), 'restaurant.create', created.id, { name: created.name, owner_phone: created.owner_phone, plan: created.plan });
  res.status(201).json({
    id: created.id, name: created.name, owner_phone: created.owner_phone,
    temp_owner_password: created.temp_owner_password, admin_pin: created.admin_pin,   // shown ONCE
  });
}));

router.patch('/restaurants/:id', access.root, handle((req, res) => {
  const r = restaurantOr404(req);
  const changed = applyPatch(r.id, req.body);
  audit.record(actorOf(req), 'restaurant.update', r.id, changed);
  res.json(stats.detail(restaurantsRepo.withOwner(r.id)));
}));

module.exports = router;
