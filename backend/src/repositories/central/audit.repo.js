'use strict';
const central = require('../../db/central');

const LIKE = "LIKE ? ESCAPE '\\'";

const insert = (a) => central.prepare(
  'INSERT INTO root_audit (at, owner_id, owner_phone, action, target, detail, ip) VALUES (?,?,?,?,?,?,?)')
  .run(a.at, a.ownerId, a.ownerPhone, a.action, a.target, a.detail, a.ip);

/** Newest first. `source` 'app' = restaurant activity (actions "app.*"), 'root' = root console, '' = both. */
function list({ limit, offset, q, source }) {
  const where = [], vals = [];
  if (source === 'app') where.push("action LIKE 'app.%'");
  if (source === 'root') where.push("action NOT LIKE 'app.%'");
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    where.push(`(action ${LIKE} OR target ${LIKE} OR detail ${LIKE} OR owner_phone ${LIKE} OR ip ${LIKE})`);
    vals.push(like, like, like, like, like);
  }
  return central.prepare(
    `SELECT * FROM root_audit ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...vals, limit, offset);
}

module.exports = { insert, list };