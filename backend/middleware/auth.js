'use strict';
/**
 * The access gate for everything under /api.
 *
 *   Barrier 1  DEVICE   the browser carries a "pos_device" cookie that was issued after the
 *                       owner logged in (phone + password) or an admin paired it with a code.
 *                       Without it nothing under /api works except the login/pairing endpoints.
 *   Barrier 2  STAFF    a staff member entered their PIN ("pos_staff" cookie).
 *                       Required for almost everything; a few pre-login endpoints only need the device.
 *
 * After the gate, the request runs inside a context (core/context.js) so the
 * database layer automatically talks to the right restaurant.
 */
const ctx = require('../core/context');
const db = require('../db/database');
const tenants = require('../core/tenants');
const {
  DEVICE_COOKIE, STAFF_COOKIE, parseCookies, findDevice, touchDevice, activeRestaurant,
} = require('../core/devices');

// No device needed
const PUBLIC = [
  /^\/health$/,
  /^\/auth\/config$/,
  /^\/auth\/owner\/(register|login)$/,
  /^\/auth\/device\/(pair|status)$/,
];

// Device needed, but staff has not logged in yet
const DEVICE_ONLY = [
  { method: 'GET',  re: /^\/settings\/?$/ },                 // branding for the PIN screen
  { method: 'POST', re: /^\/staff\/(verify|check-pin|logout)$/ },
  { method: 'GET',  re: /^\/staff\/session\/validate$/ },
];

// Who may do what. First matching rule wins; no match = any logged-in staff.
const RULES = [
  { re: /^\/(backup|reset|export|reports)(\/|$)/,                      roles: ['admin'] },
  { re: /^\/auth\/(pairing-code|devices|device\/unlink)/,               roles: ['admin'] },
  { re: /^\/staff\/?$/,                 methods: ['GET', 'POST'],        roles: ['admin'] },
  { re: /^\/staff\/\d+$/,               methods: ['PUT', 'DELETE'],      roles: ['admin'] },
  { re: /^\/settings(\/|$)/,            methods: ['PUT', 'POST'],        roles: ['admin'] },
  { re: /^\/(categories|menu|tables)(\/|$)/, methods: ['POST', 'PUT', 'PATCH', 'DELETE'], roles: ['admin'] },
  { re: /^\/orders\/(delete-records|log\/deleted)$/,                    roles: ['admin'] },
  { re: /^\/orders\/[^/]+\/payment$/,                                   roles: ['admin'] },
  { re: /^\/bug-report\/?$/,            methods: ['GET'],                roles: ['admin'] },
];

// A kitchen screen only needs to see active orders and mark them delivered.
const KITCHEN_ALLOW = [
  { method: 'GET',   re: /^\/orders\/active$/ },
  { method: 'PATCH', re: /^\/orders\/[^/]+\/deliver$/ },
  { method: 'POST',  re: /^\/bug-report\/?$/ },
  { method: 'GET',   re: /^\/settings\/?$/ },
];

function roleAllowed(req, role) {
  if (role === 'kitchen' && !KITCHEN_ALLOW.some(r => r.method === req.method && r.re.test(req.path))) return false;
  for (const r of RULES) {
    if (!r.re.test(req.path)) continue;
    if (r.methods && !r.methods.includes(req.method)) continue;
    return r.roles.includes(role);
  }
  return true;
}

function lookupStaff(cookieValue) {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf('.');
  if (dot < 1) return null;
  const staffId = Number(cookieValue.slice(0, dot));
  const token = cookieValue.slice(dot + 1);
  if (!staffId || !token) return null;
  try {
    return db.prepare(`
      SELECT s.id, s.name, s.role
      FROM staff_sessions ss JOIN staff s ON s.id = ss.staff_id
      WHERE ss.staff_id = ? AND ss.token = ? AND s.active = 1
    `).get(staffId, token) || null;
  } catch (_) { return null; }
}

function gate(req, res, next) {
  const p = req.path;
  req.cookies = parseCookies(req.headers.cookie);

  // Customer QR pages: no login, but the token itself says which restaurant
  const kiosk = p.match(/^\/kiosk\/([^/]+)/);
  if (kiosk && !['lan-ip', 'ensure-token'].includes(kiosk[1])) {
    req._smallBody = true;
    const rid = tenants.restaurantIdFromKioskToken(kiosk[1]);
    if (!rid || !activeRestaurant(rid)) return res.status(404).json({ error: 'Invalid or expired QR code' });
    req.restaurantId = rid;
    req._ctx = { restaurantId: rid, kiosk: true };
    return ctx.run(req._ctx, next);
  }

  if (PUBLIC.some(re => re.test(p))) { req._smallBody = true; return next(); }

  const device = findDevice(req.cookies[DEVICE_COOKIE]);
  if (!device) {
    return res.status(401).json({ error: 'This device is not linked to a restaurant.', code: 'device_required' });
  }
  const restaurant = activeRestaurant(device.restaurant_id);
  if (!restaurant) {
    return res.status(403).json({ error: 'This restaurant account is not active.', code: 'restaurant_suspended' });
  }
  touchDevice(device, req);

  const store = { restaurantId: restaurant.id, restaurant, device, staff: null };
  req.restaurantId = restaurant.id;   // plain copies for code that runs outside the async context (e.g. multer)
  req._ctx = store;
  ctx.run(store, () => {
    store.staff = lookupStaff(req.cookies[STAFF_COOKIE]);

    const deviceOnly = DEVICE_ONLY.some(r => r.method === req.method && r.re.test(p));
    if (!store.staff && !deviceOnly) {
      return res.status(401).json({ error: 'Please log in with your PIN.', code: 'staff_required' });
    }
    if (store.staff && !roleAllowed(req, store.staff.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.', code: 'forbidden' });
    }
    next();
  });
}

module.exports = { gate, lookupStaff, STAFF_COOKIE, DEVICE_COOKIE };