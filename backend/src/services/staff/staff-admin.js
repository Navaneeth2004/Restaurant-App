'use strict';
/** Staff accounts (admin screens). PINs are always bcrypt hashes and never returned. */
const bcrypt = require('bcryptjs');
const ctx = require('../../db/context');
const tx = require('../../db/tenant/tx');
const { fail } = require('../../lib/http');
const { clip } = require('../../lib/input');
const { pinProblem } = require('../../lib/pin-rules');
const staff = require('../../repositories/staff/staff.repo');
const limits = require('../restaurants/limits');
const pinGuard = require('./pin-guard');
const sessions = require('./sessions');

const ROLES = ['admin', 'waiter', 'kitchen'];
const hashPin = (pin) => bcrypt.hash(String(pin), 10);
const planLimit = () => limits.check(ctx.get().restaurant, 'max_staff', staff.countActive());

async function isPinTaken(pin, excludeId = null) {
  for (const s of staff.activeWithPin()) {
    if (excludeId !== null && s.id === excludeId) continue;
    if (await pinGuard.verifyPin(pin, s.pin)) return true;
  }
  return false;
}

async function checkNewPin(pin, excludeId) {
  const weak = pinProblem(pin);
  if (weak) fail(400, weak);
  if (await isPinTaken(pin, excludeId)) fail(409, 'This PIN is already in use by another staff member. Please choose a different PIN.');
}

const list = () => staff.list();

async function create({ name, pin, role }) {
  if (!name || !pin || !role) fail(400, 'name, pin, role required');
  if (!ROLES.includes(role)) fail(400, 'Invalid role');
  const lim = planLimit();
  if (!lim.ok) fail(403, `Your plan allows up to ${lim.limit} staff accounts.`, { code: 'plan_limit' });
  await checkNewPin(pin, null);
  const hashed = await hashPin(pin);
  return tx(() => {
    const again = planLimit();            // re-checked together with the insert
    if (!again.ok) fail(403, `Your plan allows up to ${again.limit} staff accounts.`, { code: 'plan_limit' });
    return staff.byId(staff.insert(clip(name, 40), hashed, role));
  });
}

/** Refuses any change that would leave the restaurant without an active admin. */
function guardLastAdmin(current, { role, active }) {
  const stopsBeingAdmin = (role && role !== 'admin') || (active !== undefined && !active);
  if (current.role === 'admin' && current.active && stopsBeingAdmin && staff.countActiveAdmins() <= 1) {
    fail(400, 'Cannot remove or deactivate the last admin account. Add another admin first.');
  }
}

async function update(id, { name, pin, role, active }) {
  if (!staff.byId(id)) fail(404, 'Staff member not found');
  if (role && !ROLES.includes(role)) fail(400, 'Invalid role');

  const hashed = pin ? (await checkNewPin(pin, id), await hashPin(pin)) : null;
  // Everything that depends on the current state is re-checked and written in ONE transaction (no check-then-act gap).
  tx(() => {
    const current = staff.byId(id);
    if (!current) fail(404, 'Staff member not found');
    guardLastAdmin(current, { role, active });
    if (active && !current.active) {
      const lim = planLimit();
      if (!lim.ok) fail(403, `Your plan allows up to ${lim.limit} staff accounts.`, { code: 'plan_limit' });
    }
    staff.update(id, {
      name: name ? clip(name, 40) : null, pin: hashed, role: role || null,
      active: active !== undefined ? (active ? 1 : 0) : null,
    });
  });
  // A changed PIN or a deactivated account ends their current session
  if (hashed || (active !== undefined && !active)) sessions.end(id);
  return { success: true };
}

function remove(id) {
  tx(() => {
    const member = staff.byId(id);
    if (!member) fail(404, 'Staff member not found');
    guardLastAdmin(member, { active: false });
    staff.remove(member.id);
  });
  sessions.end(id);
  return { success: true };
}

module.exports = { list, create, update, remove };
