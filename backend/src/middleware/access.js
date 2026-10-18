'use strict';
/**
 * Who may call a route. EVERY route must declare one of these (routes/index.js refuses to boot otherwise):
 *   access.public  no login needed (the gate decides, e.g. owner login or a customer QR token)
 *   access.device  a linked device, staff PIN not required (PIN screen, heartbeat)
 *   access.any     any logged-in staff (admin, waiter, kitchen)
 *   access.floor   admin or waiter  (everything the kitchen screen must NOT touch)
 *   access.admin   admin only
 *   access.root    the platform operator (root console)
 */
const ctx = require('../db/context');

const mark = (fn, level) => { fn.accessLevel = level; return fn; };

const deny = (res, status, error, code) => res.status(status).json({ error, code });

function staffGuard(level, roles) {
  return mark((req, res, next) => {
    const { staff } = ctx.get();
    if (!staff) return deny(res, 401, 'Please log in with your PIN.', 'staff_required');
    if (!roles.includes(staff.role)) return deny(res, 403, 'You do not have permission to do that.', 'forbidden');
    return next();
  }, level);
}

module.exports = {
  public: mark((req, res, next) => next(), 'public'),
  device: mark((req, res, next) => (ctx.get().device ? next() : deny(res, 401, 'This device is not linked to a restaurant.', 'device_required')), 'device'),
  any: staffGuard('any', ['admin', 'waiter', 'kitchen']),
  floor: staffGuard('floor', ['admin', 'waiter']),
  admin: staffGuard('admin', ['admin']),
  root: mark((req, res, next) => (req.root ? next() : deny(res, 401, 'Please log in.', 'root_required')), 'root'),
};
