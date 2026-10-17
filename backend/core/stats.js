'use strict';
/** Technical details of a restaurant for the root console. */
const fs = require('fs');
const path = require('path');
const central = require('./central');
const tenants = require('./tenants');
const cfg = require('./config');
const entitlements = require('./entitlements');

function fileSize(p) { try { return fs.statSync(p).size; } catch (_) { return 0; } }
function dirInfo(dir) {
  let bytes = 0, count = 0;
  try { for (const f of fs.readdirSync(dir)) { bytes += fileSize(path.join(dir, f)); count++; } } catch (_) {}
  return { bytes, count };
}
function dbBytes(file) {
  const p = path.join(cfg.TENANT_DIR, file);
  return fileSize(p) + fileSize(p + '-wal');
}

/** Cheap summary for the list (never opens the restaurant database). */
function summary(r) {
  const dev = central.prepare(`SELECT COUNT(*) AS n, MAX(last_seen_at) AS last_seen
                               FROM devices WHERE restaurant_id = ? AND revoked_at IS NULL`).get(r.id);
  const t = central.prepare("SELECT COUNT(*) AS n FROM tickets WHERE restaurant_id = ? AND status IN ('open','in_progress')").get(r.id);
  return {
    id: r.id, name: r.name, status: r.status, plan: r.plan, trial_ends_at: r.trial_ends_at,
    created_at: r.created_at, owner_phone: r.owner_phone, owner_id: r.owner_id,
    devices: dev.n, last_seen_at: dev.last_seen, open_tickets: t.n, db_bytes: dbBytes(r.db_file),
  };
}

/** Everything useful for support. Opens this one restaurant's database. */
function detail(r, io) {
  const owner = central.prepare('SELECT id, phone, disabled, created_at FROM owners WHERE id = ?').get(r.owner_id);
  const devices = central.prepare(`SELECT id, name, role_lock, created_via, created_at, last_seen_at, last_ip, user_agent
                                   FROM devices WHERE restaurant_id = ? AND revoked_at IS NULL ORDER BY created_at`).all(r.id);
  const tk = central.prepare(`SELECT COUNT(*) AS total, SUM(status IN ('open','in_progress')) AS open
                              FROM tickets WHERE restaurant_id = ?`).get(r.id);

  let counts = {}, activity = {}, settings = {}, schema_version = null, error = null;
  try {
    const raw = tenants.get(r.id).raw;
    const one = (sql, ...a) => raw.prepare(sql).get(...a);
    schema_version = raw.pragma('user_version', { simple: true });
    counts = {
      orders_total:   one('SELECT COUNT(*) AS c FROM orders').c,
      orders_closed:  one("SELECT COUNT(*) AS c FROM orders WHERE status = 'closed'").c,
      orders_active:  one("SELECT COUNT(*) AS c FROM orders WHERE status IN ('active','delivered')").c,
      orders_today:   one("SELECT COUNT(*) AS c FROM orders WHERE substr(created_at,1,10) = ?", new Date().toISOString().slice(0, 10)).c,
      staff_active:   one('SELECT COUNT(*) AS c FROM staff WHERE active = 1').c,
      menu_items:     one('SELECT COUNT(*) AS c FROM menu_items').c,
      categories:     one('SELECT COUNT(*) AS c FROM categories').c,
      tables:         one('SELECT COUNT(*) AS c FROM tables WHERE (is_archived IS NULL OR is_archived = 0)').c,
      deleted_records: one('SELECT COUNT(*) AS c FROM deleted_records').c,
    };
    const lo = one('SELECT MAX(created_at) AS last, MIN(created_at) AS first FROM orders');
    activity = { last_order_at: lo.last, first_order_at: lo.first };
    const rows = raw.prepare("SELECT key, value FROM settings WHERE key IN ('tax_percent','currency_symbol','state_name','gstin','kitchen_overdue_mins','b2b_enabled')").all();
    const s = Object.fromEntries(rows.map(x => [x.key, x.value]));
    settings = { tax_percent: s.tax_percent, currency: s.currency_symbol, state: s.state_name,
                 gstin_set: !!(s.gstin && s.gstin.trim()), b2b_enabled: s.b2b_enabled === 'true', kitchen_overdue_mins: s.kitchen_overdue_mins };
  } catch (e) { error = e.message; }

  let live = { staff_sockets: 0, device_sockets: 0 };
  if (io) {
    const size = (room) => (io.sockets.adapter.rooms.get(room) || new Set()).size;
    live = { staff_sockets: size(`t:${r.id}`), device_sockets: size(`t:${r.id}:dev`) };
  }

  const up = dirInfo(path.join(cfg.DATA_DIR, 'files', r.id, 'uploads'));
  let meta = {}; try { meta = r.meta_json ? JSON.parse(r.meta_json) : {}; } catch (_) {}
  const limitsOverride = entitlements.parse(r.limits_json);

  return {
    id: r.id, name: r.name, status: r.status, plan: r.plan, trial_ends_at: r.trial_ends_at,
    created_at: r.created_at, updated_at: r.updated_at, notes: r.notes || '',
    suspended_reason: r.suspended_reason, suspended_at: r.suspended_at,
    limits_override: limitsOverride, limits_effective: entitlements.limitsFor(r), meta,
    owner, devices, live,
    storage: { db_bytes: dbBytes(r.db_file), db_file: r.db_file, uploads_bytes: up.bytes, uploads_count: up.count },
    database: { schema_version, error },
    counts, activity, settings,
    tickets: { total: tk.total || 0, open: tk.open || 0 },
  };
}

module.exports = { summary, detail };