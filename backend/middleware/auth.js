'use strict';

const ctx = require('../core/context');
const central = require('../core/central');
const tenants = require('../core/tenants');
const cfg = require('../core/config');
const {
  DEVICE_COOKIE, STAFF_COOKIE, parseCookies, findDevice, activeRestaurant,
} = require('../core/devices');
const { fromRequest } = require('../core/staff-auth');

function fullPath(req) {
  return String(req.originalUrl || req.url).split('?')[0];
}

function isPublicPath(path) {
  return path === '/api/health' ||
    path === '/api/auth/device/status' ||
    path === '/api/auth/owner/login' ||
    path === '/api/auth/owner/register' ||
    path === '/api/auth/device/pair' ||
    path === '/api/auth/logout-device' ||
    path === '/api/kiosk' ||
    path.startsWith('/api/kiosk/');
}

function needsAdmin(path, method) {
  if (path === '/api/auth/devices' || path.startsWith('/api/auth/devices/') ||
      path === '/api/auth/pairing-code') return true;
  if (path === '/api/settings' || path.startsWith('/api/settings/')) return method !== 'GET';
  if (path === '/api/categories' || path.startsWith('/api/categories/')) return method !== 'GET';
  if (path.startsWith('/api/reports') || path.startsWith('/api/export') ||
      path.startsWith('/api/backup') || path.startsWith('/api/reset')) return true;
  if (path.startsWith('/api/staff')) {
    return !(
      (method === 'POST' && path === '/api/staff/verify') ||
      (method === 'POST' && path === '/api/staff/check-pin') ||
      (method === 'POST' && path === '/api/staff/logout') ||
      (method === 'GET' && path === '/api/staff/session/validate')
    );
  }
  if (path.startsWith('/api/menu')) return method !== 'GET';
  if (path.startsWith('/api/tables')) return method !== 'GET';
  if (path === '/api/kiosk/ensure-token') return true;
  if (path === '/api/orders/delete-records' || path === '/api/orders/log/deleted') return true;
  if (path.startsWith('/api/orders/') && method === 'PATCH' && path.endsWith('/payment')) return true;
  return false;
}

function runInTenant(restaurantId, values, next) {
  return ctx.run({ restaurantId, ...values }, next);
}

function gate(req, res, next) {
  const path = fullPath(req);
  const cookies = parseCookies(req.headers.cookie);
  const device = findDevice(cookies[DEVICE_COOKIE]);
  req._smallBody = isPublicPath(path);

  if (path === '/api/health') return next();

  if (path === '/api/auth/device/status') {
    if (!device) return next();
    const restaurant = activeRestaurant(device.restaurant_id);
    req.device = device;
    if (!restaurant || !restaurant.active) {
      req.restaurantSuspended = true;
      return next();
    }
    req.restaurant = restaurant;
    return runInTenant(restaurant.id, { device }, next);
  }

  if (path === '/api/auth/owner/login' || path === '/api/auth/owner/register' ||
      path === '/api/auth/device/pair' || path === '/api/auth/logout-device') {
    return next();
  }

  if (path === '/api/kiosk/lan-ip') return next();
  if (path === '/api/kiosk/ensure-token') {
    return authenticatedRequest(req, res, next, device, path);
  }
  if (path === '/api/kiosk' || path.startsWith('/api/kiosk/')) {
    const tokenMatch = /^\/api\/kiosk\/([^/]+)/.exec(path);
    if (!tokenMatch) return next();
    const restaurantId = tenants.restaurantIdFromKioskToken(tokenMatch[1]);
    if (!restaurantId) return res.status(404).json({ error: 'Invalid or expired QR code' });
    const restaurant = activeRestaurant(restaurantId);
    if (!restaurant || !restaurant.active) return next();
    req.kioskTableId = tenants.databaseFor(restaurantId)
      .prepare('SELECT id FROM tables WHERE kiosk_token = ?').get(tokenMatch[1])?.id || null;
    req.restaurant = restaurant;
    return runInTenant(restaurantId, { kiosk: true, tableId: req.kioskTableId }, next);
  }

  return authenticatedRequest(req, res, next, device, path);
}

function authenticatedRequest(req, res, next, device, path) {
  if (!device) {
    return res.status(401).json({ error: 'This device is not linked to a restaurant.', code: 'device_required' });
  }
  const restaurant = activeRestaurant(device.restaurant_id);
  if (!restaurant || !restaurant.active) {
    return res.status(403).json({ error: 'This restaurant account is not active.', code: 'restaurant_suspended' });
  }

  const now = new Date().toISOString();
  central.prepare('UPDATE devices SET last_seen_at = ?, last_ip = ? WHERE id = ?')
    .run(now, req.ip || null, device.id);
  req.device = device;
  req.restaurant = restaurant;

  return runInTenant(restaurant.id, { device }, () => {
    if (path === '/api/staff/verify') return next();
    if (path === '/api/staff/session/validate') return next();
    if (req.method === 'GET' && path === '/api/settings') return next();

    const staff = fromRequest(req);
    if (!staff) {
      res.clearCookie(STAFF_COOKIE, { path: '/' });
      return res.status(401).json({ error: 'Please enter your staff PIN.', code: 'staff_required' });
    }
    req.staff = staff;

    if (needsAdmin(path, req.method) && staff.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required.' });
    }
    return next();
  });
}

module.exports = { gate, needsAdmin };
