'use strict';
const central = require('../../db/central');

const insert = (t) => central.prepare(`
  INSERT INTO tickets (restaurant_id, restaurant_name, title, description, steps_json, severity, category,
                       submitted_by, submitted_role, device_id, device_name, ip, user_agent,
                       diagnostics_json, screenshot_file, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .run(t.restaurantId, t.restaurantName, t.title, t.description, t.stepsJson, t.severity, t.category,
    t.submittedBy, t.submittedRole, t.deviceId, t.deviceName, t.ip, t.userAgent,
    t.diagnosticsJson, t.screenshotFile, t.now, t.now).lastInsertRowid;

const forRestaurant = (restaurantId) => central.prepare(`
  SELECT id, title, description, severity, category, status, steps_json, created_at
  FROM tickets WHERE restaurant_id = ? ORDER BY id DESC LIMIT 100`).all(restaurantId);

/** Root console list. `where`/`vals` are built by services/support/tickets.js from a fixed whitelist. */
const list = (where, vals, limit, offset) => central.prepare(`
  SELECT id, restaurant_id, restaurant_name, title, severity, category, status, submitted_by, submitted_role,
         created_at, updated_at, (screenshot_file IS NOT NULL) AS has_screenshot
  FROM tickets ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, id DESC LIMIT ? OFFSET ?`)
  .all(...vals, limit, offset);

const byId = (id) => central.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
const screenshotOf = (id) => central.prepare('SELECT screenshot_file FROM tickets WHERE id = ?').get(id);
const update = (id, sets, vals) => central.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);

const countOpen = () => central.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status IN ('open','in_progress')").get().n;
const countCritical = () =>
  central.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status IN ('open','in_progress') AND severity = 'critical'").get().n;
const recent = () => central.prepare(`
  SELECT id, restaurant_id, restaurant_name, title, severity, status, created_at FROM tickets ORDER BY id DESC LIMIT 8`).all();
const openFor = (restaurantId) =>
  central.prepare("SELECT COUNT(*) AS n FROM tickets WHERE restaurant_id = ? AND status IN ('open','in_progress')").get(restaurantId).n;
const totalsFor = (restaurantId) =>
  central.prepare("SELECT COUNT(*) AS total, SUM(status IN ('open','in_progress')) AS open FROM tickets WHERE restaurant_id = ?").get(restaurantId);

module.exports = {
  insert, forRestaurant, list, byId, screenshotOf, update, countOpen, countCritical, recent, openFor, totalsFor,
};
