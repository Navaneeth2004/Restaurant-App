'use strict';
const central = require('../../db/central');

const activeById = (id) => central.prepare('SELECT * FROM devices WHERE id = ? AND revoked_at IS NULL').get(id);

const insert = (d) => central.prepare(`
  INSERT INTO devices (id, restaurant_id, name, secret_hash, token_hash, role_lock, created_via, created_at, last_seen_at, last_ip, user_agent)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
  .run(d.id, d.restaurantId, d.name, d.secretHash, d.secretHash, d.roleLock, d.via, d.now, d.now, d.ip, d.userAgent);

const touch = (id, now, ip, userAgent) =>
  central.prepare('UPDATE devices SET last_seen_at = ?, last_ip = ?, user_agent = ? WHERE id = ?').run(now, ip, userAgent, id);

const revoke = (id, restaurantId, now) =>
  central.prepare('UPDATE devices SET revoked_at = ? WHERE id = ? AND restaurant_id = ? AND revoked_at IS NULL')
    .run(now, id, restaurantId).changes > 0;
const revokeAny = (id, now) => central.prepare('UPDATE devices SET revoked_at = ? WHERE id = ?').run(now, id);
const revokeAllFor = (restaurantId, now) =>
  central.prepare('UPDATE devices SET revoked_at = ? WHERE restaurant_id = ? AND revoked_at IS NULL').run(now, restaurantId).changes;

const countActive = (restaurantId) =>
  central.prepare('SELECT COUNT(*) AS c FROM devices WHERE restaurant_id = ? AND revoked_at IS NULL').get(restaurantId).c;
const countActiveAll = () => central.prepare('SELECT COUNT(*) AS n FROM devices WHERE revoked_at IS NULL').get().n;
const summaryFor = (restaurantId) =>
  central.prepare('SELECT COUNT(*) AS n, MAX(last_seen_at) AS last_seen FROM devices WHERE restaurant_id = ? AND revoked_at IS NULL').get(restaurantId);
const listActive = (restaurantId) => central.prepare(`
  SELECT id, name, role_lock, created_via, created_at, last_seen_at, last_ip, user_agent
  FROM devices WHERE restaurant_id = ? AND revoked_at IS NULL ORDER BY created_at`).all(restaurantId);

module.exports = {
  activeById, insert, touch, revoke, revokeAny, revokeAllFor, countActive, countActiveAll, summaryFor, listActive,
};
