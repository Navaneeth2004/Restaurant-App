'use strict';
const db = require('../../db/tenant');

const get = (staffId) => db.prepare('SELECT token, created_at, last_seen_at FROM staff_sessions WHERE staff_id = ?').get(staffId);

const upsert = (staffId, token, now) =>
  db.prepare('INSERT OR REPLACE INTO staff_sessions (staff_id, token, created_at, last_seen_at) VALUES (?, ?, ?, ?)')
    .run(staffId, token, now, now);

const remove = (staffId) => db.prepare('DELETE FROM staff_sessions WHERE staff_id = ?').run(staffId);

/** Session joined with its (active) staff member, or undefined. */
const lookup = (staffId, token) => db.prepare(`
  SELECT s.id, s.name, s.role, ss.created_at, ss.last_seen_at
  FROM staff_sessions ss JOIN staff s ON s.id = ss.staff_id
  WHERE ss.staff_id = ? AND ss.token = ? AND s.active = 1`).get(staffId, token);

/** Records activity, but writes at most once per interval (pass the cutoff ISO string). */
const touch = (staffId, cutoff, now) =>
  db.prepare('UPDATE staff_sessions SET last_seen_at = ? WHERE staff_id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)')
    .run(now, staffId, cutoff);

const removeAll = () => db.prepare('DELETE FROM staff_sessions').run();

module.exports = { get, upsert, remove, removeAll, lookup, touch };
