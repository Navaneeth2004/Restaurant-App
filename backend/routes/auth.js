'use strict';
/**
 * /api/auth
 *   Public:  config, owner/register, owner/login, device/pair, device/status
 *   Admin :  pairing-code, devices (list / revoke), device/unlink
 */
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const cfg = require('../core/config');
const central = require('../core/central');
const tenants = require('../core/tenants');
const ctx = require('../core/context');
const db = require('../db/database');
const providers = require('../auth');
const { limit, failTracker } = require('../middleware/rateLimit');
const entitlements = require('../core/entitlements');
const { pinFails, isAdminPin, lockMsg: pinLockMsg } = require('../core/pin-guard');
const {
  DEVICE_COOKIE, STAFF_COOKIE, parseCookies, findDevice, linkDevice, revokeDevice, activeRestaurant,
} = require('../core/devices');
const { sha256, nowIso, normalizePhone, pinProblem, newRestaurantId } = require('../core/util');

const router = express.Router();

const ipLimit    = limit({ windowMs: 15 * 60 * 1000, max: 40, message: 'Too many attempts. Please wait a few minutes.' });
const registerLimit = limit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many accounts created from this network. Try again later.' });
const loginFails = failTracker({ max: 5, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 });
const pairFails  = failTracker({ max: 8, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 });

const lockedMsg = (s) => `Too many wrong attempts. Try again in ${Math.max(1, Math.ceil(s / 60))} minute(s).`;
const publicRestaurant = (r) => ({ id: r.id, name: r.name });

/** true when the restaurant's plan does not allow another linked device */
function deviceLimitReached(restaurantId) {
  const r = central.prepare('SELECT plan, limits_json FROM restaurants WHERE id = ?').get(restaurantId);
  const n = central.prepare('SELECT COUNT(*) AS c FROM devices WHERE restaurant_id = ? AND revoked_at IS NULL').get(restaurantId).c;
  return !!r && !entitlements.check(r, 'max_devices', n).ok;
}
const LIMIT_MSG = 'This restaurant has reached the number of devices its plan allows. Remove an old device first (Admin → Devices) or contact support.';

// ── GET /config ───────────────────────────────────────────────────────────
router.get('/config', (req, res) => {
  res.json({ registration_open: cfg.ALLOW_REGISTRATION, methods: cfg.AUTH_METHODS });
});

// ── GET /device/status — what should this browser show first? ─────────────
router.get('/device/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const base = { registration_open: cfg.ALLOW_REGISTRATION };
  const device = findDevice(parseCookies(req.headers.cookie)[DEVICE_COOKIE]);
  if (!device) return res.json({ linked: false, ...base });

  const r = activeRestaurant(device.restaurant_id);
  if (!r) return res.json({ linked: false, suspended: true, ...base });

  ctx.run({ restaurantId: r.id }, () => {
    const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('restaurant_name','brand_color','logo_url')").all();
    const s = Object.fromEntries(rows.map(x => [x.key, x.value]));
    res.json({
      linked: true,
      restaurant: { name: s.restaurant_name || r.name, brand_color: s.brand_color, logo_url: s.logo_url },
      device: { id: device.id, name: device.name, role_lock: device.role_lock },
      ...base,
    });
  });
});

// ── POST /owner/register ──────────────────────────────────────────────────
router.post('/owner/register', ipLimit, registerLimit, async (req, res) => {
  if (!cfg.ALLOW_REGISTRATION) return res.status(403).json({ error: 'New sign-ups are closed.' });

  const b = req.body || {};
  const phone = normalizePhone(b.phone, cfg.DEFAULT_COUNTRY_CODE);
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number.' });

  const provider = providers.get('password');
  const pwErr = provider.validateNew(b.password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const restaurantName = String(b.restaurant_name || '').trim().slice(0, 60);
  const adminName = String(b.admin_name || '').trim().slice(0, 40);
  if (!restaurantName) return res.status(400).json({ error: 'Enter the restaurant name.' });
  if (!adminName) return res.status(400).json({ error: 'Enter your name.' });

  const pinErr = pinProblem(b.admin_pin);
  if (pinErr) return res.status(400).json({ error: pinErr });

  if (central.prepare('SELECT 1 FROM owners WHERE phone = ?').get(phone)) {
    return res.status(409).json({ error: 'An account with this phone number already exists. Please log in instead.' });
  }

  const ownerId = crypto.randomUUID();
  const restaurantId = newRestaurantId();
  let dbFile = null;
  try {
    const [passwordHash, adminPinHash] = await Promise.all([provider.hash(b.password), bcrypt.hash(String(b.admin_pin), 10)]);
    dbFile = tenants.create({ id: restaurantId, restaurantName, adminName, adminPinHash });

    central.transaction(() => {
      central.prepare('INSERT INTO owners (id, phone, password_hash, created_at, updated_at) VALUES (?,?,?,?,?)')
        .run(ownerId, phone, passwordHash, nowIso(), nowIso());
      central.prepare('INSERT INTO restaurants (id, owner_id, name, db_file, trial_ends_at, created_at) VALUES (?,?,?,?,?,?)')
        .run(restaurantId, ownerId, restaurantName, dbFile, new Date(Date.now() + 30 * 86400000).toISOString(), nowIso());
    })();

    linkDevice(req, res, { restaurantId, name: b.device_name, via: 'register' });
    res.status(201).json({ linked: true, restaurant: { id: restaurantId, name: restaurantName } });
  } catch (err) {
    if (dbFile) tenants.remove(dbFile);
    console.error('[Auth] register failed:', err.message);
    res.status(500).json({ error: 'Could not create the account. Please try again.' });
  }
});

// ── POST /owner/login — links THIS device to a restaurant ─────────────────
router.post('/owner/login', ipLimit, async (req, res) => {
  const b = req.body || {};
  const method = b.method || 'password';
  const provider = providers.get(method);
  if (!provider) return res.status(400).json({ error: 'This login method is not available.' });

  const phone = normalizePhone(b.phone, cfg.DEFAULT_COUNTRY_CODE);
  const failKey = `${req.ip}|${phone || 'x'}`;
  const wait = loginFails.check(failKey);
  if (wait) return res.status(429).json({ error: lockedMsg(wait), code: 'locked', retry_after: wait });

  const owner = phone
    ? central.prepare("SELECT * FROM owners WHERE phone = ? AND disabled = 0 AND role = 'owner'").get(phone)
    : null;
  const ok = await provider.verify(owner, b);
  if (!ok) {
    loginFails.fail(failKey);
    return res.status(401).json({ error: 'Incorrect phone number or password.' });
  }
  loginFails.reset(failKey);

  const restaurants = central.prepare(
    "SELECT id, name FROM restaurants WHERE owner_id = ? AND status = 'active' ORDER BY created_at"
  ).all(owner.id);
  if (!restaurants.length) return res.status(403).json({ error: 'There is no active restaurant on this account.' });

  let r;
  if (b.restaurant_id) {
    r = restaurants.find(x => x.id === b.restaurant_id);
    if (!r) return res.status(404).json({ error: 'Restaurant not found on this account.' });
  } else if (restaurants.length === 1) {
    r = restaurants[0];
  } else {
    return res.json({ needs_restaurant: true, restaurants: restaurants.map(publicRestaurant) });
  }

  if (deviceLimitReached(r.id)) return res.status(403).json({ error: LIMIT_MSG, code: 'plan_limit' });
  linkDevice(req, res, { restaurantId: r.id, name: b.device_name, via: 'owner_login' });
  res.json({ linked: true, restaurant: publicRestaurant(r) });
});

// ── POST /device/pair — staff phone enters the code an admin generated ────
router.post('/device/pair', ipLimit, (req, res) => {
  const b = req.body || {};
  const code = String(b.code || '').replace(/\D/g, '');
  const failKey = `pair|${req.ip}`;
  const wait = pairFails.check(failKey);
  if (wait) return res.status(429).json({ error: lockedMsg(wait), code: 'locked', retry_after: wait });
  if (code.length !== 6) return res.status(400).json({ error: 'Enter the 6-digit code.' });

  const peek = central.prepare('SELECT restaurant_id FROM pairing_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?').get(sha256(code), nowIso());
  if (peek && deviceLimitReached(peek.restaurant_id)) return res.status(403).json({ error: LIMIT_MSG, code: 'plan_limit' });

  const row = central.transaction(() => {
    const r = central.prepare('SELECT * FROM pairing_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?')
      .get(sha256(code), nowIso());
    if (!r) return null;
    central.prepare('UPDATE pairing_codes SET used_at = ? WHERE code_hash = ?').run(nowIso(), r.code_hash);
    return r;
  })();

  const restaurant = row && activeRestaurant(row.restaurant_id);
  if (!restaurant) {
    pairFails.fail(failKey);
    return res.status(400).json({ error: 'That code is invalid or has expired. Ask your manager for a new one.' });
  }
  pairFails.reset(failKey);

  linkDevice(req, res, { restaurantId: restaurant.id, name: b.device_name, roleLock: row.role_lock, via: 'pairing' });
  res.json({ linked: true, restaurant: publicRestaurant(restaurant) });
});

// ══ Everything below needs a linked device AND an admin PIN session ═══════

// ── POST /pairing-code ────────────────────────────────────────────────────
router.post('/pairing-code', (req, res) => {
  const { restaurantId } = ctx.get();
  const roleLock = ['waiter', 'kitchen'].includes((req.body || {}).role_lock) ? req.body.role_lock : null;

  central.prepare('DELETE FROM pairing_codes WHERE expires_at < ? OR used_at IS NOT NULL').run(nowIso());
  const active = central.prepare('SELECT COUNT(*) AS c FROM pairing_codes WHERE restaurant_id = ?').get(restaurantId).c;
  if (active >= 10) return res.status(429).json({ error: 'Too many unused codes. Wait for them to expire.' });

  const expiresAt = new Date(Date.now() + cfg.PAIRING_CODE_MINUTES * 60000).toISOString();
  let code;
  for (let i = 0; i < 10; i++) {
    code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    try {
      central.prepare('INSERT INTO pairing_codes (code_hash, restaurant_id, role_lock, created_at, expires_at) VALUES (?,?,?,?,?)')
        .run(sha256(code), restaurantId, roleLock, nowIso(), expiresAt);
      break;
    } catch (_) { code = null; }
  }
  if (!code) return res.status(500).json({ error: 'Could not create a code. Try again.' });

  const origin = cfg.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  res.json({ code, expires_at: expiresAt, role_lock: roleLock, pair_url: `${origin}/pair?code=${code}` });
});

// ── GET /devices ──────────────────────────────────────────────────────────
router.get('/devices', (req, res) => {
  const { restaurantId, device } = ctx.get();
  const rows = central.prepare(`
    SELECT id, name, role_lock, created_via, created_at, last_seen_at, last_ip, user_agent
    FROM devices WHERE restaurant_id = ? AND revoked_at IS NULL ORDER BY created_at
  `).all(restaurantId);
  res.json(rows.map(d => ({ ...d, is_current: d.id === device.id })));
});

// ── DELETE /devices/:id ───────────────────────────────────────────────────
router.delete('/devices/:id', (req, res) => {
  const { restaurantId } = ctx.get();
  if (!revokeDevice(req.params.id, restaurantId)) return res.status(404).json({ error: 'Device not found.' });
  req.io.disconnectDevice(req.params.id);          // cut its live connection immediately
  res.json({ success: true });
});

// ── POST /device/unlink — "Switch restaurant" from the PIN screen (needs an ADMIN PIN) ───
router.post('/device/unlink', async (req, res) => {
  const { restaurantId, device } = ctx.get();
  const key = `chk:${device.id}`;
  const wait = pinFails.check(key);
  if (wait) return res.status(429).json({ error: pinLockMsg(wait), code: 'locked', retry_after: wait });
  if (!(await isAdminPin((req.body || {}).pin))) {
    pinFails.fail(key);
    return res.status(401).json({ error: 'Incorrect admin PIN.' });
  }
  pinFails.reset(key);
  revokeDevice(device.id, restaurantId);
  req.io.disconnectDevice(device.id);
  res.clearCookie(DEVICE_COOKIE, { path: '/' });
  res.clearCookie(STAFF_COOKIE, { path: '/' });
  res.json({ success: true });
});

module.exports = router;