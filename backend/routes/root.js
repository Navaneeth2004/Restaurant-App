'use strict';
/**
 * /api/root — the root console API (platform operator only).
 *   auth      POST /login · POST /logout · GET /me · GET /config
 *   overview  GET /overview
 *   restaurants  GET / · GET /:id · POST / · PATCH /:id · POST /:id/suspend|activate|revoke-devices|owner-password · DELETE /:id
 *   tickets   GET /tickets · GET /tickets/:id · GET /tickets/:id/screenshot · PATCH /tickets/:id
 *   audit     GET /audit
 * Authentication is done by middleware/auth.js (the pos_root cookie); /login is the only public route.
 */
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const cfg = require('../core/config');
const central = require('../core/central');
const tenants = require('../core/tenants');
const rootCore = require('../core/root');
const stats = require('../core/stats');
const entitlements = require('../core/entitlements');
const providers = require('../auth');
const { failTracker } = require('../middleware/rateLimit');
const { normalizePhone, pinProblem, newRestaurantId, nowIso } = require('../core/util');

const router = express.Router();
const loginFails = failTracker({ max: 5, windowMs: 15 * 60 * 1000, lockMs: 30 * 60 * 1000 });

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const err = (res, code, msg) => res.status(code).json({ error: msg });
const rid = (req) => String(req.params.id || '');
const io = (req) => req.app.get('io');

function getRestaurant(id) {
  return central.prepare(`
    SELECT r.*, o.phone AS owner_phone FROM restaurants r JOIN owners o ON o.id = r.owner_id WHERE r.id = ?`).get(id);
}
function kickRestaurant(req, id) {
  const server = io(req);
  if (!server) return;
  server.in(`t:${id}`).disconnectSockets(true);
  server.in(`t:${id}:dev`).disconnectSockets(true);
}
function randomPassword() { return crypto.randomBytes(9).toString('base64url'); }   // 12 chars
function randomPin() {
  for (let i = 0; i < 50; i++) { const p = String(crypto.randomInt(1000, 10000)); if (!pinProblem(p)) return p; }
  return '4729';
}
function validateLimits(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    if (!entitlements.LIMIT_KEYS[k]) throw new Error(`Unknown limit: ${k}`);
    const v = obj[k];
    if (v === null || v === '' || v === undefined) continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) throw new Error(`${entitlements.LIMIT_KEYS[k].label} must be a whole number`);
    out[k] = n;
  }
  return out;
}

// ═══ AUTH ════════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  const b = req.body || {};
  const phone = normalizePhone(b.phone, cfg.DEFAULT_COUNTRY_CODE);
  const key = `root|${req.ip}`;
  const wait = loginFails.check(key);
  if (wait) return err(res, 429, `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`);

  const owner = phone ? central.prepare("SELECT * FROM owners WHERE phone = ? AND role = 'root' AND disabled = 0").get(phone) : null;
  const ok = await providers.get('password').verify(owner, b);
  if (!ok) {
    loginFails.fail(key);
    rootCore.audit({ ip: req.ip }, 'root.login_failed', phone || 'invalid');
    return err(res, 401, 'Incorrect phone number or password.');
  }
  loginFails.reset(key);
  rootCore.createSession(req, res, owner);
  rootCore.audit({ ip: req.ip, root: { owner: { id: owner.id, phone: owner.phone } } }, 'root.login');
  res.json({ phone: owner.phone });
});

router.post('/logout', (req, res) => {
  rootCore.audit(req, 'root.logout');
  rootCore.destroySession(req, res);
  res.json({ success: true });
});

router.get('/me', (req, res) => res.json({ phone: req.root.owner.phone }));

router.get('/config', (req, res) => {
  res.json({
    plans: Object.keys(entitlements.PLANS),
    limit_keys: Object.entries(entitlements.LIMIT_KEYS).map(([key, v]) => ({ key, label: v.label })),
    plan_defaults: entitlements.PLANS,
    ticket_statuses: STATUSES,
    enforce_trial: cfg.ENFORCE_TRIAL,
  });
});

// ═══ OVERVIEW ════════════════════════════════════════════════════════════
router.get('/overview', (req, res) => {
  const c = (sql, ...a) => central.prepare(sql).get(...a);
  const byStatus = central.prepare('SELECT status, COUNT(*) AS n FROM restaurants GROUP BY status').all();
  const trialSoon = central.prepare(`SELECT id, name, trial_ends_at FROM restaurants
      WHERE plan = 'trial' AND status = 'active' AND trial_ends_at IS NOT NULL AND trial_ends_at < ? ORDER BY trial_ends_at LIMIT 10`)
    .all(new Date(Date.now() + 7 * 86400000).toISOString());
  const recentTickets = central.prepare(`SELECT id, restaurant_id, restaurant_name, title, severity, status, created_at
      FROM tickets ORDER BY id DESC LIMIT 8`).all();
  const active = central.prepare(`SELECT r.id, r.name, MAX(d.last_seen_at) AS last_seen
      FROM restaurants r LEFT JOIN devices d ON d.restaurant_id = r.id AND d.revoked_at IS NULL
      GROUP BY r.id ORDER BY last_seen DESC LIMIT 8`).all();
  const server = io(req);
  res.json({
    restaurants: { total: byStatus.reduce((s, r) => s + r.n, 0), by_status: Object.fromEntries(byStatus.map(r => [r.status, r.n])) },
    owners: c("SELECT COUNT(*) AS n FROM owners WHERE role = 'owner'").n,
    devices: c('SELECT COUNT(*) AS n FROM devices WHERE revoked_at IS NULL').n,
    tickets: {
      open: c("SELECT COUNT(*) AS n FROM tickets WHERE status IN ('open','in_progress')").n,
      critical_open: c("SELECT COUNT(*) AS n FROM tickets WHERE status IN ('open','in_progress') AND severity = 'critical'").n,
    },
    connected_sockets: server ? server.engine.clientsCount : null,
    trial_ending_soon: trialSoon, recent_tickets: recentTickets, recently_active: active,
    server: { node: process.version, uptime_s: Math.round(process.uptime()), memory_mb: Math.round(process.memoryUsage().rss / 1048576), deployment: cfg.DEPLOYMENT },
  });
});

// ═══ RESTAURANTS ═════════════════════════════════════════════════════════
router.get('/restaurants', (req, res) => {
  const rows = central.prepare(`SELECT r.*, o.phone AS owner_phone FROM restaurants r
                                JOIN owners o ON o.id = r.owner_id ORDER BY r.created_at DESC`).all();
  res.json(rows.map(stats.summary));
});

router.get('/restaurants/:id', (req, res) => {
  const r = getRestaurant(rid(req));
  if (!r) return err(res, 404, 'Restaurant not found');
  res.json(stats.detail(r, io(req)));
});

router.post('/restaurants', async (req, res) => {
  const b = req.body || {};
  const name = String(b.restaurant_name || '').trim().slice(0, 60);
  if (!name) return err(res, 400, 'Restaurant name is required.');
  const phone = normalizePhone(b.owner_phone, cfg.DEFAULT_COUNTRY_CODE);
  if (!phone) return err(res, 400, 'Enter a valid owner phone number.');
  const adminName = String(b.admin_name || '').trim().slice(0, 40) || 'Admin';
  const plan = b.plan || 'trial';
  if (!entitlements.PLANS[plan]) return err(res, 400, 'Unknown plan.');

  let adminPin = String(b.admin_pin || '');
  let generatedPin = false;
  if (!adminPin) { adminPin = randomPin(); generatedPin = true; }
  const pinErr = pinProblem(adminPin);
  if (pinErr) return err(res, 400, pinErr);

  let owner = central.prepare('SELECT * FROM owners WHERE phone = ?').get(phone);
  if (owner && owner.role !== 'owner') return err(res, 400, 'That phone number belongs to a root account.');
  let tempPassword = null;
  const restaurantId = newRestaurantId();
  let dbFile = null;
  try {
    if (!owner) {
      tempPassword = b.owner_password ? String(b.owner_password) : randomPassword();
      const pwErr = providers.get('password').validateNew(tempPassword);
      if (pwErr) return err(res, 400, pwErr);
      owner = { id: crypto.randomUUID() };
      central.prepare("INSERT INTO owners (id, phone, password_hash, role, created_at, updated_at) VALUES (?,?,?,'owner',?,?)")
        .run(owner.id, phone, await providers.get('password').hash(tempPassword), nowIso(), nowIso());
      if (b.owner_password) tempPassword = null;     // the root user typed it; no need to echo it back
    }
    const adminPinHash = await bcrypt.hash(adminPin, 10);
    dbFile = tenants.create({ id: restaurantId, restaurantName: name, adminName, adminPinHash });
    const trialDays = b.trial_days === undefined || b.trial_days === '' ? 30 : Math.max(0, parseInt(b.trial_days, 10) || 0);
    central.prepare(`INSERT INTO restaurants (id, owner_id, name, db_file, plan, trial_ends_at, notes, created_at, updated_at)
                     VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(restaurantId, owner.id, name, dbFile, plan,
        plan === 'trial' ? new Date(Date.now() + trialDays * 86400000).toISOString() : null,
        b.notes ? String(b.notes).slice(0, 2000) : null, nowIso(), nowIso());
  } catch (e) {
    if (dbFile) tenants.remove(dbFile);
    console.error('[Root] create restaurant failed:', e.message);
    return err(res, 500, 'Could not create the restaurant.');
  }
  rootCore.audit(req, 'restaurant.create', restaurantId, { name, owner_phone: phone, plan });
  res.status(201).json({
    id: restaurantId, name, owner_phone: phone,
    // shown ONCE so you can pass them to the customer
    temp_owner_password: tempPassword, admin_pin: generatedPin ? adminPin : null,
  });
});

router.patch('/restaurants/:id', (req, res) => {
  const r = getRestaurant(rid(req));
  if (!r) return err(res, 404, 'Restaurant not found');
  const b = req.body || {};
  const sets = [], vals = [], changed = {};
  const set = (col, val, label) => { sets.push(`${col} = ?`); vals.push(val); changed[label || col] = val; };

  try {
    if (b.name !== undefined) {
      const n = String(b.name).trim().slice(0, 60);
      if (!n) return err(res, 400, 'Name cannot be empty.');
      set('name', n);
    }
    if (b.plan !== undefined) {
      if (!entitlements.PLANS[b.plan]) return err(res, 400, 'Unknown plan.');
      set('plan', b.plan);
    }
    if (b.trial_ends_at !== undefined) {
      if (b.trial_ends_at === null || b.trial_ends_at === '') set('trial_ends_at', null);
      else {
        const d = new Date(b.trial_ends_at);
        if (Number.isNaN(d.getTime())) return err(res, 400, 'Invalid trial end date.');
        set('trial_ends_at', d.toISOString());
      }
    }
    if (b.notes !== undefined) set('notes', String(b.notes).slice(0, 4000));
    if (b.limits !== undefined) set('limits_json', JSON.stringify(validateLimits(b.limits)), 'limits');
    if (b.meta !== undefined) {
      if (typeof b.meta !== 'object' || Array.isArray(b.meta)) return err(res, 400, 'meta must be an object.');
      const s = JSON.stringify(b.meta);
      if (s.length > 8000) return err(res, 400, 'meta is too large.');
      set('meta_json', s, 'meta');
    }
  } catch (e) { return err(res, 400, e.message); }

  if (!sets.length) return err(res, 400, 'Nothing to update.');
  sets.push('updated_at = ?'); vals.push(nowIso());
  central.prepare(`UPDATE restaurants SET ${sets.join(', ')} WHERE id = ?`).run(...vals, r.id);
  rootCore.audit(req, 'restaurant.update', r.id, changed);
  res.json(stats.detail(getRestaurant(r.id), io(req)));
});

router.post('/restaurants/:id/suspend', (req, res) => {
  const r = getRestaurant(rid(req));
  if (!r) return err(res, 404, 'Restaurant not found');
  const reason = String((req.body || {}).reason || '').trim().slice(0, 200) || null;
  central.prepare("UPDATE restaurants SET status = 'suspended', suspended_reason = ?, suspended_at = ?, updated_at = ? WHERE id = ?")
    .run(reason, nowIso(), nowIso(), r.id);
  kickRestaurant(req, r.id);
  rootCore.audit(req, 'restaurant.suspend', r.id, { reason });
  res.json({ success: true });
});

router.post('/restaurants/:id/activate', (req, res) => {
  const r = getRestaurant(rid(req));
  if (!r) return err(res, 404, 'Restaurant not found');
  central.prepare("UPDATE restaurants SET status = 'active', suspended_reason = NULL, suspended_at = NULL, updated_at = ? WHERE id = ?")
    .run(nowIso(), r.id);
  rootCore.audit(req, 'restaurant.activate', r.id);
  res.json({ success: true });
});

router.post('/restaurants/:id/revoke-devices', (req, res) => {
  const r = getRestaurant(rid(req));
  if (!r) return err(res, 404, 'Restaurant not found');
  const n = central.prepare('UPDATE devices SET revoked_at = ? WHERE restaurant_id = ? AND revoked_at IS NULL').run(nowIso(), r.id).changes;
  kickRestaurant(req, r.id);
  rootCore.audit(req, 'restaurant.revoke_devices', r.id, { count: n });
  res.json({ success: true, revoked: n });
});

router.post('/restaurants/:id/owner-password', async (req, res) => {
  const r = getRestaurant(rid(req));
  if (!r) return err(res, 404, 'Restaurant not found');
  const provided = (req.body || {}).password;
  const password = provided ? String(provided) : randomPassword();
  const pwErr = providers.get('password').validateNew(password);
  if (pwErr) return err(res, 400, pwErr);
  central.prepare('UPDATE owners SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(await providers.get('password').hash(password), nowIso(), r.owner_id);
  rootCore.audit(req, 'owner.password_reset', r.owner_id, { restaurant: r.id });
  res.json({ success: true, temp_password: provided ? null : password });
});

router.delete('/restaurants/:id', async (req, res) => {
  const r = getRestaurant(rid(req));
  if (!r) return err(res, 404, 'Restaurant not found');
  const b = req.body || {};
  if (String(b.confirm_name || '') !== r.name) return err(res, 400, 'Type the restaurant name exactly to confirm.');
  const me = central.prepare('SELECT * FROM owners WHERE id = ?').get(req.root.owner.id);
  if (!(await providers.get('password').verify(me, { password: b.password }))) return err(res, 403, 'Your root password is incorrect.');

  kickRestaurant(req, r.id);
  tenants.close(r.id);
  central.transaction(() => {
    central.prepare('DELETE FROM pairing_codes WHERE restaurant_id = ?').run(r.id);
    central.prepare('DELETE FROM devices WHERE restaurant_id = ?').run(r.id);
    central.prepare('DELETE FROM restaurants WHERE id = ?').run(r.id);
  })();
  tenants.remove(r.db_file);
  fs.rmSync(path.join(cfg.DATA_DIR, 'files', r.id), { recursive: true, force: true });
  rootCore.audit(req, 'restaurant.delete', r.id, { name: r.name });     // tickets are kept as history
  res.json({ success: true });
});

// ═══ TICKETS ═════════════════════════════════════════════════════════════
router.get('/tickets', (req, res) => {
  const { status, restaurant, severity, q } = req.query;
  const where = [], vals = [];
  if (status === 'active') where.push("status IN ('open','in_progress')");
  else if (STATUSES.includes(status)) { where.push('status = ?'); vals.push(status); }
  if (restaurant) { where.push('restaurant_id = ?'); vals.push(String(restaurant)); }
  if (severity) { where.push('severity = ?'); vals.push(String(severity)); }
  if (q) { where.push('(title LIKE ? OR description LIKE ? OR restaurant_name LIKE ?)'); const l = `%${String(q).slice(0, 60)}%`; vals.push(l, l, l); }
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 300);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const rows = central.prepare(`
    SELECT id, restaurant_id, restaurant_name, title, severity, category, status, submitted_by, submitted_role,
           created_at, updated_at, (screenshot_file IS NOT NULL) AS has_screenshot
    FROM tickets ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, id DESC LIMIT ? OFFSET ?`).all(...vals, limit, offset);
  res.json(rows);
});

router.get('/tickets/:id', (req, res) => {
  const t = central.prepare('SELECT * FROM tickets WHERE id = ?').get(parseInt(req.params.id, 10));
  if (!t) return err(res, 404, 'Ticket not found');
  const parse = (j, d) => { try { return j ? JSON.parse(j) : d; } catch (_) { return d; } };
  const restaurant = central.prepare('SELECT id, name, status, plan FROM restaurants WHERE id = ?').get(t.restaurant_id) || null;
  res.json({
    ...t, steps: parse(t.steps_json, []), diagnostics: parse(t.diagnostics_json, null),
    has_screenshot: !!t.screenshot_file, restaurant, steps_json: undefined, diagnostics_json: undefined, screenshot_file: undefined,
  });
});

router.get('/tickets/:id/screenshot', (req, res) => {
  const t = central.prepare('SELECT screenshot_file FROM tickets WHERE id = ?').get(parseInt(req.params.id, 10));
  if (!t || !t.screenshot_file) return res.status(404).end();
  const full = path.join(cfg.DATA_DIR, 'tickets', path.basename(t.screenshot_file));
  if (!fs.existsSync(full)) return res.status(404).end();
  res.set('Content-Security-Policy', "default-src 'none'; sandbox");
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(full);
});

router.patch('/tickets/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = central.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  if (!t) return err(res, 404, 'Ticket not found');
  const b = req.body || {};
  const sets = [], vals = [], changed = {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return err(res, 400, 'Invalid status.');
    sets.push('status = ?'); vals.push(b.status); changed.status = b.status;
    sets.push('resolved_at = ?'); vals.push(['resolved', 'closed'].includes(b.status) ? nowIso() : null);
  }
  if (b.root_note !== undefined) { sets.push('root_note = ?'); vals.push(String(b.root_note).slice(0, 4000)); changed.root_note = true; }
  if (!sets.length) return err(res, 400, 'Nothing to update.');
  sets.push('updated_at = ?'); vals.push(nowIso());
  central.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  rootCore.audit(req, 'ticket.update', String(id), changed);
  res.json({ success: true });
});

// ═══ AUDIT ═══════════════════════════════════════════════════════════════
router.get('/audit', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
  res.json(central.prepare('SELECT * FROM root_audit ORDER BY id DESC LIMIT ?').all(limit));
});

module.exports = router;