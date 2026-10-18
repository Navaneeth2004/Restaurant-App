'use strict';
const central = require('../../db/central');

const purgeExpired = (now) => central.prepare('DELETE FROM root_sessions WHERE expires_at < ?').run(now);
const insert = (s) => central.prepare(
  'INSERT INTO root_sessions (id, owner_id, created_at, expires_at, last_seen_at, ip, user_agent) VALUES (?,?,?,?,?,?,?)')
  .run(s.id, s.ownerId, s.now, s.expiresAt, s.now, s.ip, s.userAgent);
const find = (id) => central.prepare(`
  SELECT s.id, s.last_seen_at, s.expires_at, o.id AS owner_id, o.phone
  FROM root_sessions s JOIN owners o ON o.id = s.owner_id
  WHERE s.id = ? AND o.role = 'root' AND o.disabled = 0`).get(id);
const touch = (id, now) => central.prepare('UPDATE root_sessions SET last_seen_at = ? WHERE id = ?').run(now, id);
const remove = (id) => central.prepare('DELETE FROM root_sessions WHERE id = ?').run(id);

module.exports = { purgeExpired, insert, find, touch, remove };
