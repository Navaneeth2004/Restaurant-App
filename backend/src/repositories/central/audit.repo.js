'use strict';
const central = require('../../db/central');

const insert = (a) => central.prepare(
  'INSERT INTO root_audit (at, owner_id, owner_phone, action, target, detail, ip) VALUES (?,?,?,?,?,?,?)')
  .run(a.at, a.ownerId, a.ownerPhone, a.action, a.target, a.detail, a.ip);
const list = (limit) => central.prepare('SELECT * FROM root_audit ORDER BY id DESC LIMIT ?').all(limit);

module.exports = { insert, list };
