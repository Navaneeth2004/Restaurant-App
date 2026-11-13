'use strict';
/**
 * Writes what restaurants do (logins, changes, deletions, money actions) into the audit log once the response has gone out.
 * To log one more action, add a line to RULES. It must never break a request, so every error is swallowed.
 */
const audit = require('../services/root/audit');

// [method, path under /api, action, also log failures (as "<action>_failed")]
const RULES = [
  ['POST', /^\/auth\/owner\/login\/?$/, 'app.owner.login', true],
  ['POST', /^\/auth\/owner\/register\/?$/, 'app.owner.register', false],
  ['POST', /^\/auth\/device\/pair\/?$/, 'app.device.pair', true],
  ['POST', /^\/auth\/device\/unlink\/?$/, 'app.device.unlink', true],
  ['POST', /^\/auth\/pairing-code\/?$/, 'app.device.pairing_code', false],
  ['DELETE', /^\/auth\/devices\/([^/]+)\/?$/, 'app.device.remove', false],
  ['POST', /^\/staff\/verify\/?$/, 'app.staff.login', true],
  ['POST', /^\/staff\/check-pin\/?$/, 'app.staff.check_pin', true],
  ['POST', /^\/staff\/logout\/?$/, 'app.staff.logout', false],
  ['POST', /^\/staff\/?$/, 'app.staff.create', false],
  ['PUT', /^\/staff\/([^/]+)\/?$/, 'app.staff.update', false],
  ['DELETE', /^\/staff\/([^/]+)\/?$/, 'app.staff.remove', false],
  ['PUT', /^\/settings\/?$/, 'app.settings.update', false],
  ['POST', /^\/menu\/?$/, 'app.menu.create', false],
  ['PUT', /^\/menu\/([^/]+)\/?$/, 'app.menu.update', false],
  ['DELETE', /^\/menu\/([^/]+)\/?$/, 'app.menu.delete', false],
  ['POST', /^\/categories\/?$/, 'app.category.create', false],
  ['PUT', /^\/categories\/([^/]+)\/?$/, 'app.category.update', false],
  ['DELETE', /^\/categories\/([^/]+)\/?$/, 'app.category.delete', false],
  ['POST', /^\/tables\/?$/, 'app.table.create', false],
  ['PUT', /^\/tables\/([^/]+)\/?$/, 'app.table.update', false],
  ['DELETE', /^\/tables\/([^/]+)\/?$/, 'app.table.delete', false],
  ['PATCH', /^\/orders\/([^/]+)\/payment\/?$/, 'app.payment.edit', false],
  ['PATCH', /^\/orders\/([^/]+)\/close\/?$/, 'app.order.close', true],
  ['PATCH', /^\/orders\/([^/]+)\/cancel\/?$/, 'app.order.cancel_round', false],
  ['PATCH', /^\/orders\/([^/]+)\/cancel-item\/?$/, 'app.order.cancel_item', false],
  ['POST', /^\/orders\/direct-bill\/?$/, 'app.order.direct_bill', false],
  ['POST', /^\/orders\/delete-records\/?$/, 'app.records.delete', true],
  ['GET', /^\/backup\/download\/?$/, 'app.backup.download', false],
  ['POST', /^\/backup\/restore\/?$/, 'app.backup.restore', false],
  ['POST', /^\/reset\/?$/, 'app.factory_reset', true],
];

function record(req, res, rule) {
  const [, pattern, action, logFailures] = rule;
  const ok = res.statusCode < 400;
  if (!ok && !logFailures) return;
  const store = req._ctx || {};
  const mine = res.locals.audit || {};
  const restaurant = mine.restaurant || store.restaurant || null;
  const staff = mine.staff || store.staff || null;
  const body = req.body || {};
  const detail = {
    restaurant: restaurant ? restaurant.name : undefined,
    by: staff ? staff.name : undefined,
    role: staff ? staff.role : undefined,
    item: (req.path.match(pattern) || [])[1],
    item_id: /cancel-item/.test(req.path) ? body.item_id : undefined,
    status: ok ? undefined : res.statusCode,
    phone: !ok && typeof body.phone === 'string' ? body.phone.slice(0, 20) : undefined,
    ...(mine.detail || {}),
  };
  audit.record({ ip: req.ip }, ok ? action : `${action}_failed`, restaurant ? restaurant.id : undefined, detail);
}

module.exports = (req, res, next) => {
  const rule = RULES.find(r => r[0] === req.method && r[1].test(req.path));
  if (rule) res.on('finish', () => { try { record(req, res, rule); } catch (_) { /* the audit log must never break a request */ } });
  next();
};
