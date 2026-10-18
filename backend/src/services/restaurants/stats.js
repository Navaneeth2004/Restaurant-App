'use strict';
/** Technical details of a restaurant for the root console. */
const fs = require('fs');
const path = require('path');
const cfg = require('../../config/env');
const ctx = require('../../db/context');
const restaurants = require('../../repositories/central/restaurants.repo');
const devices = require('../../repositories/central/devices.repo');
const tickets = require('../../repositories/central/tickets.repo');
const owners = require('../../repositories/central/owners.repo');
const overview = require('../../repositories/catalog/overview.repo');
const settings = require('../../repositories/catalog/settings.repo');
const rooms = require('../../realtime/rooms');
const bus = require('../../realtime/bus');
const limits = require('./limits');

const fileSize = (p) => { try { return fs.statSync(p).size; } catch (_) { return 0; } };

function dirInfo(dir) {
  let bytes = 0, count = 0;
  try { for (const f of fs.readdirSync(dir)) { bytes += fileSize(path.join(dir, f)); count++; } } catch (_) { /* no folder */ }
  return { bytes, count };
}

function dbBytes(file) {
  const p = path.join(cfg.TENANT_DIR, file);
  return fileSize(p) + fileSize(`${p}-wal`);
}

/** Cheap summary for the list (never opens the restaurant database). */
function summary(r) {
  const dev = devices.summaryFor(r.id);
  return {
    id: r.id, name: r.name, status: r.status, plan: r.plan, trial_ends_at: r.trial_ends_at,
    created_at: r.created_at, owner_phone: r.owner_phone, owner_id: r.owner_id,
    devices: dev.n, last_seen_at: dev.last_seen, open_tickets: tickets.openFor(r.id), db_bytes: dbBytes(r.db_file),
  };
}

/** What the restaurant's own database says (null on failure, plus the error text). */
function readTenantData(id) {
  try {
    return ctx.run({ restaurantId: id }, () => {
      const s = settings.all();
      const span = overview.orderSpan();
      return {
        error: null,
        schema_version: overview.schemaVersion(),
        counts: overview.counts(new Date().toISOString().slice(0, 10)),
        activity: { last_order_at: span.last, first_order_at: span.first },
        settings: {
          tax_percent: s.tax_percent, currency: s.currency_symbol, state: s.state_name,
          gstin_set: !!(s.gstin && s.gstin.trim()), b2b_enabled: s.b2b_enabled === 'true', kitchen_overdue_mins: s.kitchen_overdue_mins,
        },
      };
    });
  } catch (e) {
    return { error: e.message, schema_version: null, counts: {}, activity: {}, settings: {} };
  }
}

/** Everything useful for support. Opens this one restaurant's database. */
function detail(r) {
  const tk = tickets.totalsFor(r.id);
  const t = readTenantData(r.id);
  const uploads = dirInfo(path.join(cfg.FILES_DIR, r.id, 'uploads'));
  let meta = {};
  try { meta = r.meta_json ? JSON.parse(r.meta_json) : {}; } catch (_) { /* keep {} */ }

  return {
    id: r.id, name: r.name, status: r.status, plan: r.plan, trial_ends_at: r.trial_ends_at,
    created_at: r.created_at, updated_at: r.updated_at, notes: r.notes || '',
    suspended_reason: r.suspended_reason, suspended_at: r.suspended_at,
    limits_override: limits.parse(r.limits_json), limits_effective: limits.limitsFor(r), meta,
    owner: owners.contact(r.owner_id),
    devices: devices.listActive(r.id),
    live: { staff_sockets: bus.roomSize(rooms.staff(r.id)), device_sockets: bus.roomSize(rooms.branding(r.id)) },
    storage: { db_bytes: dbBytes(r.db_file), db_file: r.db_file, uploads_bytes: uploads.bytes, uploads_count: uploads.count },
    database: { schema_version: t.schema_version, error: t.error },
    counts: t.counts, activity: t.activity, settings: t.settings,
    tickets: { total: tk.total || 0, open: tk.open || 0 },
  };
}

const listSummaries = () => restaurants.listWithOwner().map(summary);

module.exports = { summary, detail, listSummaries };
