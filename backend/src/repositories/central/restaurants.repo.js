'use strict';
const central = require('../../db/central');

const WITH_OWNER = 'SELECT r.*, o.phone AS owner_phone FROM restaurants r JOIN owners o ON o.id = r.owner_id';
const UPDATABLE = new Set(['name', 'plan', 'trial_ends_at', 'notes', 'limits_json', 'meta_json']);

const byId = (id) => central.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
const withOwner = (id) => central.prepare(`${WITH_OWNER} WHERE r.id = ?`).get(id);
const listWithOwner = () => central.prepare(`${WITH_OWNER} ORDER BY r.created_at DESC`).all();
const listForCli = () => central.prepare(`
  SELECT r.id, r.name, r.status, r.plan, r.created_at, o.phone,
         (SELECT COUNT(*) FROM devices d WHERE d.restaurant_id = r.id AND d.revoked_at IS NULL) AS devices
  FROM restaurants r JOIN owners o ON o.id = r.owner_id ORDER BY r.created_at`).all();
const activeForOwner = (ownerId) =>
  central.prepare("SELECT id, name FROM restaurants WHERE owner_id = ? AND status = 'active' ORDER BY created_at").all(ownerId);
const accessRow = (id) => central.prepare(`
  SELECT id, owner_id, name, status, plan, trial_ends_at, limits_json, meta_json, suspended_reason
  FROM restaurants WHERE id = ?`).get(id);
const planRow = (id) => central.prepare('SELECT plan, limits_json FROM restaurants WHERE id = ?').get(id);

const insert = (r) => central.prepare(`
  INSERT INTO restaurants (id, owner_id, name, db_file, plan, trial_ends_at, notes, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?)`)
  .run(r.id, r.ownerId, r.name, r.dbFile, r.plan || 'trial', r.trialEndsAt || null, r.notes || null, r.now, r.now);

/** Dynamic update limited to a whitelist of columns. */
function update(id, fields, now) {
  const cols = Object.keys(fields).filter(c => UPDATABLE.has(c));
  if (!cols.length) return 0;
  const sets = cols.map(c => `${c} = ?`).concat('updated_at = ?').join(', ');
  return central.prepare(`UPDATE restaurants SET ${sets} WHERE id = ?`).run(...cols.map(c => fields[c]), now, id).changes;
}

const suspend = (id, reason, now) =>
  central.prepare("UPDATE restaurants SET status = 'suspended', suspended_reason = ?, suspended_at = ?, updated_at = ? WHERE id = ?")
    .run(reason, now, now, id).changes;
const activate = (id, now) =>
  central.prepare("UPDATE restaurants SET status = 'active', suspended_reason = NULL, suspended_at = NULL, updated_at = ? WHERE id = ?")
    .run(now, id).changes;

/** Removes the restaurant's central rows (devices, pairing codes, the restaurant). Tickets are kept as history. */
const deleteCentral = (id) => central.transaction(() => {
  central.prepare('DELETE FROM pairing_codes WHERE restaurant_id = ?').run(id);
  central.prepare('DELETE FROM devices WHERE restaurant_id = ?').run(id);
  central.prepare('DELETE FROM restaurants WHERE id = ?').run(id);
})();

/** Atomically creates the owner (if new) and the restaurant. */
const createWithOwner = ({ owner, restaurant }) => central.transaction(() => {
  if (owner) {
    central.prepare('INSERT INTO owners (id, phone, password_hash, role, created_at, updated_at) VALUES (?,?,?,?,?,?)')
      .run(owner.id, owner.phone, owner.passwordHash, 'owner', restaurant.now, restaurant.now);
  }
  insert(restaurant);
})();

const countByStatus = () => central.prepare('SELECT status, COUNT(*) AS n FROM restaurants GROUP BY status').all();
const trialEndingBefore = (iso) => central.prepare(`
  SELECT id, name, trial_ends_at FROM restaurants
  WHERE plan = 'trial' AND status = 'active' AND trial_ends_at IS NOT NULL AND trial_ends_at < ?
  ORDER BY trial_ends_at LIMIT 10`).all(iso);
const recentlyActive = () => central.prepare(`
  SELECT r.id, r.name, MAX(d.last_seen_at) AS last_seen
  FROM restaurants r LEFT JOIN devices d ON d.restaurant_id = r.id AND d.revoked_at IS NULL
  GROUP BY r.id ORDER BY last_seen DESC LIMIT 8`).all();
const countAll = () => central.prepare('SELECT COUNT(*) AS c FROM restaurants').get().c;
const idsAndFiles = () => central.prepare('SELECT id FROM restaurants').all();

module.exports = {
  byId, withOwner, listWithOwner, listForCli, activeForOwner, accessRow, planRow, insert, update, suspend, activate,
  deleteCentral, createWithOwner, countByStatus, trialEndingBefore, recentlyActive, countAll, idsAndFiles,
};
