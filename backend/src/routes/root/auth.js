'use strict';
/** Root console login/logout. The session cookie is only sent to /api/root and is SameSite=Strict. */
const express = require('express');
const cfg = require('../../config/env');
const access = require('../../middleware/access');
const { handle, clientMeta } = require('../../lib/http');
const { ROOT_COOKIE } = require('../../lib/cookies');
const rootAuth = require('../../services/root/auth');
const rootSessions = require('../../services/root/sessions');
const audit = require('../../services/root/audit');
const { consoleConfig } = require('../../services/root/overview');
const { actorOf } = require('./helpers');

const router = express.Router();

router.post('/login', access.public, handle(async (req, res) => {
  const owner = await rootAuth.login(req.body || {}, req.ip);
  const { token, maxAgeMs } = rootSessions.create(owner, clientMeta(req));
  res.cookie(ROOT_COOKIE, token, { httpOnly: true, secure: cfg.COOKIE_SECURE, sameSite: 'strict', path: '/api/root', maxAge: maxAgeMs });
  audit.record({ ip: req.ip, owner: { id: owner.id, phone: owner.phone } }, 'root.login');
  res.json({ phone: owner.phone });
}));

router.post('/logout', access.root, (req, res) => {
  audit.record(actorOf(req), 'root.logout');
  rootSessions.destroy(req.cookies[ROOT_COOKIE]);
  res.clearCookie(ROOT_COOKIE, { path: '/api/root' });
  res.json({ success: true });
});

router.get('/me', access.root, (req, res) => res.json({ phone: req.root.owner.phone }));
router.get('/config', access.root, (req, res) => res.json(consoleConfig()));

module.exports = router;
