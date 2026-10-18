'use strict';
const db = require('../../db/tenant');

const list = () => db.prepare('SELECT id, name, role, active FROM staff ORDER BY name').all();
const byId = (id) => db.prepare('SELECT id, name, role, active FROM staff WHERE id = ?').get(id);
/** Active staff WITH their pin hashes (login only; never send to a client). */
const activeWithPin = () => db.prepare('SELECT id, name, role, pin FROM staff WHERE active = 1').all();
const activeAdminsWithPin = () => db.prepare("SELECT id, name, pin FROM staff WHERE role = 'admin' AND active = 1").all();
const countActive = () => db.prepare('SELECT COUNT(*) AS c FROM staff WHERE active = 1').get().c;
const countActiveAdmins = () => db.prepare("SELECT COUNT(*) AS c FROM staff WHERE role = 'admin' AND active = 1").get().c;

const insert = (name, pinHash, role) =>
  db.prepare('INSERT INTO staff (name, pin, role) VALUES (?, ?, ?)').run(name, pinHash, role).lastInsertRowid;

const update = (id, { name, pin, role, active }) => db.prepare(`
  UPDATE staff SET name = COALESCE(?, name), pin = COALESCE(?, pin), role = COALESCE(?, role), active = COALESCE(?, active)
  WHERE id = ?`).run(name, pin, role, active, id);

const remove = (id) => db.prepare('DELETE FROM staff WHERE id = ?').run(id);

module.exports = { list, byId, activeWithPin, activeAdminsWithPin, countActive, countActiveAdmins, insert, update, remove };
