'use strict';

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { AUTH_METHODS } = require('../auth');
const central = require('../core/central');
const ctx = require('../core/context');
const tenants = require('../core/tenants');
const cfg = require('../core/config');
const {
  DEVICE_COOKIE, STAFF_COOKIE, parseCookies, digest, createDevice, findDevice,
  setDeviceCookie, clearDeviceCookie, cookieOptions,
} = require('../core/devices');
const { normalizePhone, pinProblem } = require('../core/util');
const { failTracker } = require('../middleware/rateLimit');

const ownerFails = failTracker({ max: 8, windowMs: 10 * 60 * 1000, lockMs: 10 *  60 * 1000 });
const pairFails = failTracker({ max: 8, windowMs: 10 * 60 * 1000, lockMs: 10 * 60 * 1000 });

function lockMessage(wait) {
  return `Too many attempts. Try again in ${Math.max(1, Math.ceil(wait / 60000))} minute(s).`;
}

function deviceName(req, name) {
  const supplied = String(name || '').trim();
  if (supplied) return supplied.slice(0, 40);
  const agent = String(req.get('user-agent') || '');
  return (agent.includes('Mobile') ? 'Mobile device' : 'Computer').slice(0, 40);
}

function linkDevice(req, res, restaurantId, name, roleLock, createdVia) {
  const created = createDevice(restaurantId, {
    name: deviceName(req, name),
    roleLock,
    createdVia,
  });
  setDeviceCookie(res, created.raw);
}

router.get('/device/status', (req, res) => {
  if (req.restaurantSuspended) {
    return res.json({ linked: false, suspended: true, registration_open: cfg.ALLOW_REGISTRATION });
  }
  if (!req.device || !req.restaurant) {
    return res.json({ linked: false, registration_open: cfg.ALLOW_REGISTRATION });
  }
  const settings = Object.fromEntries(
    require('../db/database').prepare("SELECT key, value FROM settings WHERE key IN ('restaurant_name','brand_color','logo_url')").all()
      .map(row => [row.key, row.value])
  );
  res.json({
    linked: true,
    registration_open: cfg.ALLOW_REGISTRATION,
    restaurant: {
      name: settings.restaurant_name || req.restaurant.name,
      brand_color: settings.brand_color,
      logo_url: settings.logo_url,
    },
  });
});

router.post('/owner/register', async (req, res) => {
  if (!cfg.ALLOW_REGISTRATION) return res.status(403).json({ error: 'New restaurant registration is closed.' });
  const { restaurant_name, admin_name, phone, password, admin_pin } = req.body || {};
  const normalizedPhone = normalizePhone(phone);
  const restaurantName = String(restaurant_name || '').trim();
  const adminName = String(admin_name || '').trim();
  const pinError = pinProblem(admin_pin);

  if (restaurantName.length < 2 || adminName.length < 2) {
    return res.status(400).json({ error: 'Restaurant and owner names must be at least 2 characters.' });
  }
  if (normalizedPhone.length < 7) return res.status(400).json({ error: 'Enter a valid phone number.' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (pinError) return res.status(400).json({ error: pinError });
  if (central.prepare('SELECT 1 FROM owners WHERE phone = ?').get(normalizedPhone)) {
    return res.status(409).json({ error: 'An account with this phone number already exists.' });
  }

  const ownerId = uuidv4();
  const restaurantId = uuidv4();
  const now = new Date().toISOString();
  const passwordHash = await AUTH_METHODS.password.hash(password);
  try {
    central.transaction(() => {
      central.prepare('INSERT INTO owners (id, phone, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .run(ownerId, normalizedPhone, passwordHash, now);
      central.prepare('INSERT INTO restaurants (id, owner_id, name, active, created_at) VALUES (?, ?, ?, 1, ?)')
        .run(restaurantId, ownerId, restaurantName.slice(0, 60), now);
    })();
    tenants.createRestaurantDatabase(restaurantId, {
      restaurantName,
      admin: { name: adminName, pin: admin_pin },
    });
    linkDevice(req, res, restaurantId, null, null, 'owner');
    return res.status(201).json({ success: true, restaurant_id: restaurantId });
  } catch (err) {
    console.error('[Auth] Registration error:', err.message);
    try { tenants.removeRestaurantDatabase(restaurantId); }
    catch (cleanupError) { console.error('[Auth] Tenant cleanup error:', cleanupError.message); }
    try {
      central.prepare('DELETE FROM restaurants WHERE id = ?').run(restaurantId);
      central.prepare('DELETE FROM owners WHERE id = ?').run(ownerId);
    } catch (cleanupError) {
      console.error('[Auth] Registration cleanup error:', cleanupError.message);
    }
    return res.status(500).json({ error: 'Could not create the restaurant account.' });
  }
});

router.post('/owner/login', async (req, res) => {
  const { phone, password, restaurant_id, method = 'password' } = req.body || {};
  const provider = AUTH_METHODS[method];
  if (!provider) return res.status(400).json({ error: 'Unsupported owner login method.' });
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || typeof password !== 'string') {
    return res.status(400).json({ error: 'Phone number and password are required.' });
  }
  const key = `owner:${req.ip || 'unknown'}:${normalizedPhone}`;
  const wait = ownerFails.check(key);
  if (wait) return res.status(429).json({ error: lockMessage(wait), code: 'locked', retry_after: wait });

  const owner = central.prepare('SELECT id, password_hash FROM owners WHERE phone = ?').get(normalizedPhone);
  if (!owner || !(await provider.verify(password, owner.password_hash))) {
    ownerFails.fail(key);
    return res.status(401).json({ error: 'Phone number or password is incorrect.' });
  }
  ownerFails.reset(key);
  const restaurants = central.prepare(
    'SELECT id, name FROM restaurants WHERE owner_id = ? AND active = 1 ORDER BY created_at'
  ).all(owner.id);
  if (!restaurants.length) return res.status(403).json({ error: 'No active restaurant is linked to this account.' });
  if (!restaurant_id && restaurants.length > 1) {
    return res.json({ needs_restaurant: true, restaurants });
  }
  const restaurant = restaurant_id
    ? restaurants.find(row => row.id === restaurant_id)
    : restaurants[0];
  if (!restaurant) return res.status(403).json({ error: 'This restaurant is not linked to your account.' });

  linkDevice(req, res, restaurant.id, null, null, 'owner');
  res.json({ success: true, restaurant_id: restaurant.id });
});

router.post('/device/pair', (req, res) => {
  const { code, device_name } = req.body || {};
  if (!/^\d{6}$/.test(String(code || ''))) return res.status(400).json({ error: 'Enter the 6-digit pairing code.' });
  const key = `pair:${req.ip || 'unknown'}`;
  const wait = pairFails.check(key);
  if (wait) return res.status(429).json({ error: lockMessage(wait), code: 'locked', retry_after: wait });

  const now = new Date().toISOString();
  try {
    const linked = central.transaction(() => {
      const pairing = central.prepare(`
        SELECT p.code_hash, p.restaurant_id, p.role_lock FROM pairing_codes p
        JOIN restaurants r ON r.id = p.restaurant_id AND r.active = 1
        WHERE p.code_hash = ? AND p.used_at IS NULL AND p.expires_at > ?
      `).get(digest(code), now);
      if (!pairing) return false;
      const updated = central.prepare(
        'UPDATE pairing_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?'
      ).run(now, pairing.code_hash, now);
      if (updated.changes !== 1) return false;
      const created = createDevice(pairing.restaurant_id, {
        name: deviceName(req, device_name),
        roleLock: pairing.role_lock,
        createdVia: 'pairing',
      });
      setDeviceCookie(res, created.raw);
      return true;
    })();
    if (!linked) {
      pairFails.fail(key);
      return res.status(400).json({ error: 'That code is invalid, expired, or already used.' });
    }
    pairFails.reset(key);
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Pairing error:', err.message);
    res.status(500).json({ error: 'Could not connect this device.' });
  }
});

router.post('/pairing-code', (req, res) => {
  const roleLock = req.body?.role_lock || null;
  if (roleLock !== null && !['waiter', 'kitchen'].includes(roleLock)) {
    return res.status(400).json({ error: 'Invalid role lock.' });
  }
  const { restaurantId, staff } = ctx.get();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
  let code;
  for (let tries = 0; tries < 5; tries += 1) {
    code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    try {
      central.prepare(`
        INSERT INTO pairing_codes (code_hash, restaurant_id, created_by, role_lock, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(digest(code), restaurantId, staff?.name || null, roleLock, expiresAt.toISOString(), createdAt.toISOString());
      break;
    } catch (err) {
      if (tries === 4) throw err;
      code = null;
    }
  }
  if (!code) return res.status(500).json({ error: 'Could not generate a pairing code.' });
  const base = cfg.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  res.status(201).json({
    code,
    expires_at: expiresAt.toISOString(),
    pair_url: `${base}/pair?code=${code}`,
    role_lock: roleLock,
  });
});

router.get('/devices', (req, res) => {
  const restaurantId = ctx.get().restaurantId;
  const currentId = req.device?.id;
  const rows = central.prepare(`
    SELECT id, name, role_lock, created_via, created_at, last_seen_at, last_ip
    FROM devices WHERE restaurant_id = ? ORDER BY created_at DESC
  `).all(restaurantId);
  res.json(rows.map(row => ({ ...row, is_current: row.id === currentId })));
});

router.delete('/devices/:id', (req, res) => {
  const restaurantId = ctx.get().restaurantId;
  const row = central.prepare('SELECT id FROM devices WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurantId);
  if (!row) return res.status(404).json({ error: 'Device not found.' });
  central.prepare('DELETE FROM devices WHERE id = ?').run(row.id);
  req.io.revokeDevice(row.id);
  if (row.id === req.device.id) {
    res.clearCookie(DEVICE_COOKIE, { ...cookieOptions(0), expires: new Date(0) });
    res.clearCookie(STAFF_COOKIE, { ...cookieOptions(0), expires: new Date(0) });
  }
  res.json({ success: true });
});

router.post('/logout-device', (req, res) => {
  const device = findDevice(parseCookies(req.headers.cookie)[DEVICE_COOKIE]);
  if (device) central.prepare('DELETE FROM devices WHERE id = ?').run(device.id);
  clearDeviceCookie(res);
  res.clearCookie(STAFF_COOKIE, { ...cookieOptions(0), expires: new Date(0) });
  res.json({ success: true });
});

module.exports = router;
