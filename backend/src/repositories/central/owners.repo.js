'use strict';
const central = require('../../db/central');

const byPhone = (phone) => central.prepare('SELECT * FROM owners WHERE phone = ?').get(phone);
/** First account found among the phone's stored variants (see lib/phone.js). */
const byPhones = (phones) => { for (const p of phones) { const r = byPhone(p); if (r) return r; } return null; };
const byId = (id) => central.prepare('SELECT * FROM owners WHERE id = ?').get(id);
const activeOwnerByPhones = (phones) => {
  const r = byPhones(phones);
  return r && r.role === 'owner' && !r.disabled ? r : null;
};
const activeRootByPhone = (phone) =>
  central.prepare("SELECT * FROM owners WHERE phone = ? AND role = 'root' AND disabled = 0").get(phone) || null;

const insert = ({ id, phone, passwordHash, role = 'owner', now }) =>
  central.prepare('INSERT INTO owners (id, phone, password_hash, role, created_at, updated_at) VALUES (?,?,?,?,?,?)')
    .run(id, phone, passwordHash, role, now, now);

const setPassword = (id, hash, now) =>
  central.prepare('UPDATE owners SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now, id);
const reviveRoot = (id, hash, now) =>
  central.prepare('UPDATE owners SET password_hash = ?, disabled = 0, updated_at = ? WHERE id = ?').run(hash, now, id);
const setDisabled = (id, disabled) =>
  central.prepare('UPDATE owners SET disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id).changes;

const countOwners = () => central.prepare("SELECT COUNT(*) AS n FROM owners WHERE role = 'owner'").get().n;
const countAll = () => central.prepare('SELECT COUNT(*) AS c FROM owners').get().c;
const listRoots = () => central.prepare("SELECT phone, disabled, created_at FROM owners WHERE role = 'root'").all();
const removeRoot = (phone) => central.prepare("DELETE FROM owners WHERE phone = ? AND role = 'root'").run(phone).changes;
const contact = (id) => central.prepare('SELECT id, phone, disabled, created_at FROM owners WHERE id = ?').get(id);

module.exports = {
  byPhone, byPhones, byId, activeOwnerByPhones, activeRootByPhone, insert, setPassword, reviveRoot,
  setDisabled, countOwners, countAll, listRoots, removeRoot, contact,
};
