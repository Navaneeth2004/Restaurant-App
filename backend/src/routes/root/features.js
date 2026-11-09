'use strict';
/** Root console: subscriptions (what each kind of customer may use) and the global switches (turn a feature off for everyone). */
const express = require('express');
const access = require('../../middleware/access');
const { handle } = require('../../lib/http');
const { FEATURES } = require('../../config/features');
const subscriptions = require('../../services/features/subscriptions');
const switches = require('../../services/features/switches');
const audit = require('../../services/root/audit');
const { actorOf } = require('./helpers');

const router = express.Router();

router.get('/features', access.root, (req, res) => res.json({ features: FEATURES, switches: switches.list() }));

router.put('/features/:feature', access.root, handle((req, res) => {
  const { off, message } = req.body || {};
  switches.set(req.params.feature, off === true, message);
  audit.record(actorOf(req), off === true ? 'feature.switch_off' : 'feature.switch_on', req.params.feature, off === true ? { message } : undefined);
  res.json({ success: true });
}));

router.get('/subscriptions', access.root, (req, res) => res.json(subscriptions.list()));

router.post('/subscriptions', access.root, handle((req, res) => {
  const created = subscriptions.create(req.body || {});
  audit.record(actorOf(req), 'subscription.create', created.slug, { name: created.name, disabled: created.disabled });
  res.status(201).json(created);
}));

router.put('/subscriptions/:slug', access.root, handle((req, res) => {
  const updated = subscriptions.update(req.params.slug, req.body || {});
  audit.record(actorOf(req), 'subscription.update', updated.slug, { name: updated.name, disabled: updated.disabled, limits: updated.limits });
  res.json(updated);
}));

router.delete('/subscriptions/:slug', access.root, handle((req, res) => {
  subscriptions.remove(req.params.slug);
  audit.record(actorOf(req), 'subscription.delete', req.params.slug);
  res.json({ success: true });
}));

module.exports = router;
