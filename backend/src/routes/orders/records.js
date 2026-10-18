'use strict';
/** Admin-only: permanent deletion of closed visits (admin PIN required) and its audit log. */
const express = require('express');
const access = require('../../middleware/access');
const ctx = require('../../db/context');
const { handle, fail } = require('../../lib/http');
const pinGuard = require('../../services/staff/pin-guard');
const { deleteClosedVisits, listDeleted } = require('../../services/orders/delete-records');
const events = require('../../realtime/order-events');

const router = express.Router();

router.post('/delete-records', access.admin, handle(async (req, res) => {
  const { order_ids, pin } = req.body || {};
  const admin = pin ? await pinGuard.adminByPin(`chk:${ctx.get().device.id}`, pin) : null;
  if (!admin) fail(403, 'Incorrect admin PIN');
  const deleted = deleteClosedVisits(order_ids, admin.name);
  console.log(`[Orders] ${admin.name} deleted ${deleted.length} closed order(s) from history`);
  events.tablesChanged(req.io);
  res.json({ success: true, deleted_ids: deleted });
}));

router.get('/log/deleted', access.admin, (req, res) => res.json(listDeleted(500)));

module.exports = router;
