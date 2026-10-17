'use strict';
/**
 * /api/bug-report — support tickets.
 * Tickets are saved in the central database where the ROOT console reads them (no more email).
 *   POST /   any logged-in staff member sends a ticket (title, description, steps, diagnostics, screenshot)
 *   GET  /   a restaurant admin sees that restaurant's own earlier tickets ("Past Reports")
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const cfg = require('../core/config');
const central = require('../core/central');
const ctx = require('../core/context');
const { limit } = require('../middleware/rateLimit');
const { nowIso } = require('../core/util');

const router = express.Router();
const ticketsDir = path.join(cfg.DATA_DIR, 'tickets');

const sendLimit = limit({
  windowMs: 60 * 60 * 1000, max: 10, message: 'You have sent several reports in the last hour. Please wait a little.',
  key: (req) => `t:${(ctx.get() || {}).device ? ctx.get().device.id : req.ip}`,
});

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const clip = (v, n) => String(v === undefined || v === null ? '' : v).trim().slice(0, n);

router.post('/', sendLimit, (req, res) => {
  const b = req.body || {};
  const title = clip(b.title, 120), description = clip(b.description, 5000);
  if (!title || !description) return res.status(400).json({ error: 'title and description are required' });

  const store = ctx.get();
  const severity = SEVERITIES.includes(b.severity) ? b.severity : 'medium';
  const steps = (Array.isArray(b.steps) ? b.steps : []).slice(0, 30).map(s => clip(s, 300)).filter(Boolean);

  // diagnostics are collected by the browser; keep them but cap the size
  let diagnostics = b.diagnostics && typeof b.diagnostics === 'object' ? b.diagnostics : null;
  if (diagnostics) {
    if (Array.isArray(diagnostics.consoleErrors)) diagnostics.consoleErrors = diagnostics.consoleErrors.slice(-30).map(e => clip(e, 600));
    if (JSON.stringify(diagnostics).length > 100000) diagnostics = { note: 'diagnostics were too large and were dropped' };
  }

  // screenshot (data URL) -> file
  let screenshotFile = null;
  const m = typeof b.screenshot === 'string' && b.screenshot.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (m) {
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length <= 4 * 1024 * 1024) {
      fs.mkdirSync(ticketsDir, { recursive: true });
      screenshotFile = `${store.restaurantId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${m[1] === 'png' ? 'png' : 'jpg'}`;
      fs.writeFileSync(path.join(ticketsDir, screenshotFile), buf);
    }
  }

  const info = central.prepare(`
    INSERT INTO tickets (restaurant_id, restaurant_name, title, description, steps_json, severity, category,
                         submitted_by, submitted_role, device_id, device_name, ip, user_agent,
                         diagnostics_json, screenshot_file, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(store.restaurantId, store.restaurant.name, title, description, JSON.stringify(steps), severity, clip(b.category, 40) || null,
      store.staff ? store.staff.name : null, store.staff ? store.staff.role : null,
      store.device.id, store.device.name, req.ip || null, clip(req.headers['user-agent'], 200),
      diagnostics ? JSON.stringify(diagnostics) : null, screenshotFile, nowIso(), nowIso());

  // email_sent:true keeps the existing "Report sent!" screen — the ticket has reached the support team
  res.status(201).json({ success: true, email_sent: true, ticket_id: info.lastInsertRowid });
});

router.get('/', (req, res) => {
  const rows = central.prepare(`
    SELECT id, title, description, severity, category, status, steps_json, created_at
    FROM tickets WHERE restaurant_id = ? ORDER BY id DESC LIMIT 100`).all(ctx.get().restaurantId);
  res.json(rows.map(r => {
    let steps = []; try { steps = JSON.parse(r.steps_json || '[]'); } catch (_) {}
    return { id: r.id, title: r.title, description: r.description, severity: r.severity, category: r.category || 'other',
             status: r.status, email_sent: true, created_at: r.created_at, steps };
  }));
});

module.exports = router;