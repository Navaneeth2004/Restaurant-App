'use strict';
/** Support tickets: staff send them, the root console reads and answers them. */
const fs = require('fs');
const path = require('path');
const cfg = require('../../config/env');
const { fail } = require('../../lib/http');
const { clip } = require('../../lib/input');
const { randomHex } = require('../../lib/crypto');
const tickets = require('../../repositories/central/tickets.repo');

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const MAX_SCREENSHOT = 4 * 1024 * 1024;

function saveScreenshot(restaurantId, dataUrl) {
  const m = typeof dataUrl === 'string' && dataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_SCREENSHOT) return null;
  fs.mkdirSync(cfg.TICKETS_DIR, { recursive: true });
  const file = `${restaurantId}_${Date.now()}_${randomHex(4)}.${m[1] === 'png' ? 'png' : 'jpg'}`;
  fs.writeFileSync(path.join(cfg.TICKETS_DIR, file), buf);
  return file;
}

function cleanDiagnostics(d) {
  if (!d || typeof d !== 'object') return null;
  if (Array.isArray(d.consoleErrors)) d.consoleErrors = d.consoleErrors.slice(-30).map(e => clip(e, 600));
  return JSON.stringify(d).length > 100000 ? { note: 'diagnostics were too large and were dropped' } : d;
}

/** @param who { restaurant, device, staff } from the request context */
function create(body = {}, who, meta) {
  const title = clip(body.title, 120), description = clip(body.description, 5000);
  if (!title || !description) fail(400, 'title and description are required');

  const steps = (Array.isArray(body.steps) ? body.steps : []).slice(0, 30).map(s => clip(s, 300)).filter(Boolean);
  const diagnostics = cleanDiagnostics(body.diagnostics);
  const id = tickets.insert({
    restaurantId: who.restaurant.id, restaurantName: who.restaurant.name, title, description,
    stepsJson: JSON.stringify(steps), severity: SEVERITIES.includes(body.severity) ? body.severity : 'medium',
    category: clip(body.category, 40) || null,
    submittedBy: who.staff ? who.staff.name : null, submittedRole: who.staff ? who.staff.role : null,
    deviceId: who.device.id, deviceName: who.device.name, ip: meta.ip, userAgent: clip(meta.userAgent, 200),
    diagnosticsJson: diagnostics ? JSON.stringify(diagnostics) : null,
    screenshotFile: saveScreenshot(who.restaurant.id, body.screenshot), now: new Date().toISOString(),
  });
  return { success: true, email_sent: true, ticket_id: id };   // email_sent keeps the existing "Report sent!" screen
}

function listForRestaurant(restaurantId) {
  return tickets.forRestaurant(restaurantId).map((r) => {
    let steps = [];
    try { steps = JSON.parse(r.steps_json || '[]'); } catch (_) { /* keep [] */ }
    return { id: r.id, title: r.title, description: r.description, severity: r.severity, category: r.category || 'other',
             status: r.status, email_sent: true, created_at: r.created_at, steps };
  });
}

// ── root console ──
function rootList(q = {}) {
  const where = [], vals = [];
  if (q.status === 'active') where.push("status IN ('open','in_progress')");
  else if (STATUSES.includes(q.status)) { where.push('status = ?'); vals.push(q.status); }
  if (q.restaurant) { where.push('restaurant_id = ?'); vals.push(String(q.restaurant)); }
  if (q.severity) { where.push('severity = ?'); vals.push(String(q.severity)); }
  if (q.q) { where.push('(title LIKE ? OR description LIKE ? OR restaurant_name LIKE ?)'); const l = `%${String(q.q).slice(0, 60)}%`; vals.push(l, l, l); }
  const limit = Math.min(parseInt(q.limit, 10) || 100, 300);
  const offset = Math.max(parseInt(q.offset, 10) || 0, 0);
  return tickets.list(where, vals, limit, offset);
}

function rootGet(id, restaurantLookup) {
  const t = tickets.byId(id);
  if (!t) fail(404, 'Ticket not found');
  const parse = (j, d) => { try { return j ? JSON.parse(j) : d; } catch (_) { return d; } };
  return {
    ...t, steps: parse(t.steps_json, []), diagnostics: parse(t.diagnostics_json, null),
    has_screenshot: !!t.screenshot_file, restaurant: restaurantLookup(t.restaurant_id),
    steps_json: undefined, diagnostics_json: undefined, screenshot_file: undefined,
  };
}

/** @returns absolute path of the screenshot, or null */
function screenshotPath(id) {
  const t = tickets.screenshotOf(id);
  if (!t || !t.screenshot_file) return null;
  const full = path.join(cfg.TICKETS_DIR, path.basename(t.screenshot_file));
  return fs.existsSync(full) ? full : null;
}

function rootUpdate(id, body = {}) {
  if (!tickets.byId(id)) fail(404, 'Ticket not found');
  const sets = [], vals = [], changed = {};
  const now = new Date().toISOString();
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) fail(400, 'Invalid status.');
    sets.push('status = ?'); vals.push(body.status); changed.status = body.status;
    sets.push('resolved_at = ?'); vals.push(['resolved', 'closed'].includes(body.status) ? now : null);
  }
  if (body.root_note !== undefined) { sets.push('root_note = ?'); vals.push(String(body.root_note).slice(0, 4000)); changed.root_note = true; }
  if (!sets.length) fail(400, 'Nothing to update.');
  sets.push('updated_at = ?'); vals.push(now);
  tickets.update(id, sets, vals);
  return changed;
}

module.exports = { STATUSES, create, listForRestaurant, rootList, rootGet, screenshotPath, rootUpdate };
