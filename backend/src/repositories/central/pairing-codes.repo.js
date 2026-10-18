'use strict';
const central = require('../../db/central');

const VALID = 'code_hash = ? AND used_at IS NULL AND expires_at > ?';

const peek = (hash, now) => central.prepare(`SELECT restaurant_id FROM pairing_codes WHERE ${VALID}`).get(hash, now);
const purge = (now) => central.prepare('DELETE FROM pairing_codes WHERE expires_at < ? OR used_at IS NOT NULL').run(now);
const countFor = (restaurantId) => central.prepare('SELECT COUNT(*) AS c FROM pairing_codes WHERE restaurant_id = ?').get(restaurantId).c;
const insert = ({ hash, restaurantId, roleLock, now, expiresAt }) =>
  central.prepare('INSERT INTO pairing_codes (code_hash, restaurant_id, role_lock, created_at, expires_at) VALUES (?,?,?,?,?)')
    .run(hash, restaurantId, roleLock, now, expiresAt);

/** Marks a valid code as used and returns it (null when invalid/expired/used). Atomic. */
const redeem = (hash, now) => central.transaction(() => {
  const row = central.prepare(`SELECT * FROM pairing_codes WHERE ${VALID}`).get(hash, now);
  if (!row) return null;
  central.prepare('UPDATE pairing_codes SET used_at = ? WHERE code_hash = ?').run(now, row.code_hash);
  return row;
})();

module.exports = { peek, purge, countFor, insert, redeem };
