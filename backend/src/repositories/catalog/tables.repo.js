'use strict';
const db = require('../../db/tenant');

const NOT_ARCHIVED = '(is_archived IS NULL OR is_archived = 0)';

/** Visible tables, each with the time its current visit started (earliest open order, deterministic on ties). */
const listVisible = () => db.prepare(`
  SELECT t.*, o.created_at AS occupied_since
  FROM tables t
  LEFT JOIN orders o ON o.rowid = (
    SELECT o2.rowid FROM orders o2
    WHERE o2.table_id = t.id AND o2.status IN ('active', 'delivered')
    ORDER BY o2.created_at ASC, o2.rowid ASC LIMIT 1)
  WHERE (t.is_archived IS NULL OR t.is_archived = 0)
  ORDER BY t.sort_order ASC, t.id ASC`).all();

const byId = (id) => db.prepare('SELECT * FROM tables WHERE id = ?').get(id);
const allIds = () => db.prepare('SELECT id FROM tables').all().map(r => r.id);
const countVisible = () => db.prepare(`SELECT COUNT(*) AS c FROM tables WHERE ${NOT_ARCHIVED} AND (is_parcel = 0 OR is_parcel IS NULL)`).get().c;
const maxSort = () => db.prepare('SELECT MAX(sort_order) AS m FROM tables').get().m ?? 0;

const insert = ({ id, label, seats, sortOrder }) =>
  db.prepare('INSERT INTO tables (id, label, seats, sort_order) VALUES (?, ?, ?, ?)').run(id, label, seats, sortOrder);
const update = (id, { label, seats, status }) =>
  db.prepare('UPDATE tables SET label = COALESCE(?, label), seats = COALESCE(?, seats), status = COALESCE(?, status) WHERE id = ?')
    .run(label, seats, status, id);
const reorder = (rows) => {
  const stmt = db.prepare('UPDATE tables SET sort_order = ? WHERE id = ?');
  db.transaction(() => rows.forEach(({ id, sort_order }) => stmt.run(sort_order, id)))();
};
const setStatus = (id, status) => db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(status, id);
const hardDelete = (id) => db.prepare('DELETE FROM tables WHERE id = ?').run(id);
/** Hides a table that has order history and invalidates its QR code. */
const archive = (id) => db.prepare("UPDATE tables SET is_archived = 1, status = 'empty', kiosk_token = NULL WHERE id = ?").run(id);
const hasOrderHistory = (id) => !!db.prepare('SELECT 1 FROM orders WHERE table_id = ? LIMIT 1').get(id);
const deleteAll = () => db.prepare('DELETE FROM tables').run();

// ── QR (kiosk) tokens ──
const tokenOf = (id) => (db.prepare('SELECT kiosk_token FROM tables WHERE id = ?').get(id) || {}).kiosk_token || null;
const setToken = (id, token) => db.prepare('UPDATE tables SET kiosk_token = ? WHERE id = ?').run(token, id);
const byToken = (token) => db.prepare(`SELECT * FROM tables WHERE kiosk_token = ? AND ${NOT_ARCHIVED}`).get(token) || null;
const idByToken = (token) => (db.prepare('SELECT id FROM tables WHERE kiosk_token = ?').get(token) || {}).id || null;

/** Removes QR tokens that do not start with this restaurant's id (they could never be routed). */
const clearForeignTokens = (rid) =>
  db.prepare('UPDATE tables SET kiosk_token = NULL WHERE kiosk_token IS NOT NULL AND kiosk_token NOT LIKE ?').run(`${rid}%`);
const clearAllTokens = () => db.prepare('UPDATE tables SET kiosk_token = NULL').run();

// ── Parcel slots ──
const parcelIds = () => db.prepare("SELECT id FROM tables WHERE id GLOB 'P[0-9]*'").all().map(r => r.id);
const insertParcel = ({ id, label, sortOrder, customerName, customerPhone, token }) =>
  db.prepare(`INSERT INTO tables (id, label, seats, status, sort_order, is_parcel, is_archived, customer_name, customer_phone, kiosk_token)
              VALUES (?, ?, 0, 'empty', ?, 1, 0, ?, ?, ?)`).run(id, label, sortOrder, customerName, customerPhone, token);
const listParcels = () => db.prepare('SELECT * FROM tables WHERE is_parcel = 1 AND is_archived = 0 ORDER BY sort_order, id').all();

module.exports = {
  listVisible, byId, allIds, countVisible, maxSort, insert, update, reorder, setStatus, hardDelete, archive,
  hasOrderHistory, deleteAll, clearForeignTokens, clearAllTokens, tokenOf, setToken, byToken, idByToken, parcelIds, insertParcel, listParcels,
};
