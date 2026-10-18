'use strict';
/** Owner sign-up and login (these link THIS device to a restaurant). */
const express = require('express');
const access = require('../../middleware/access');
const { handle } = require('../../lib/http');
const ownerAuth = require('../../services/auth/owner-auth');
const { linkAndSetCookie, ipLimit, registerLimit } = require('./helpers');

const router = express.Router();

router.post('/owner/register', access.public, ipLimit, registerLimit, handle(async (req, res) => {
  const created = await ownerAuth.register(req.body || {});
  linkAndSetCookie(req, res, { restaurantId: created.id, name: (req.body || {}).device_name, via: 'register' });
  res.status(201).json({ linked: true, restaurant: { id: created.id, name: created.name } });
}));

router.post('/owner/login', access.public, ipLimit, handle(async (req, res) => {
  const out = await ownerAuth.login(req.body || {}, req.ip);
  if (out.choices) return res.json({ needs_restaurant: true, restaurants: out.choices });
  linkAndSetCookie(req, res, { restaurantId: out.restaurant.id, name: (req.body || {}).device_name, via: 'owner_login' });
  return res.json({ linked: true, restaurant: out.restaurant });
}));

module.exports = router;
