'use strict';
/** PIN login (barrier 2: the device is already linked). */
const { fail } = require('../../lib/http');
const staff = require('../../repositories/staff/staff.repo');
const bus = require('../../realtime/bus');
const ctx = require('../../db/context');
const pinGuard = require('./pin-guard');
const sessions = require('./sessions');

/** A device holds one staff session at a time: switching user ends the previous member's session. */
function endPreviousMemberOnThisDevice(cookieValue, newMemberId) {
  const previous = sessions.parseCookieValue(cookieValue);
  if (!previous || previous.id === newMemberId) return;
  const row = sessions.current(previous.id);
  if (row && row.token === previous.token) sessions.end(previous.id);
}

/**
 * @param device        the linked device row (carries an optional role_lock)
 * @param cookieValue   this request's pos_staff cookie (identifies "same device" even if the page lost its token)
 * @returns { id, name, role, sessionToken, cookieValue }
 */
async function pinLogin({ pin, currentSessionToken, cookieValue, device }) {
  if (!pin) fail(400, 'PIN required');
  const key = `dev:${device.id}`;
  pinGuard.assertNotLocked(key);

  for (const member of staff.activeWithPin()) {
    if (!(await pinGuard.verifyPin(pin, member.pin))) continue;

    // A kitchen tablet should not become a waiter terminal (admins may always log in)
    if (device.role_lock && member.role !== device.role_lock && member.role !== 'admin') {
      fail(403, `This device is only for ${device.role_lock} staff.`);
    }

    // Already logged in elsewhere? Only block while that session is genuinely in use.
    const existing = sessions.current(member.id);
    if (existing && sessions.isLive(existing)) {
      const sameDevice = (currentSessionToken && existing.token === currentSessionToken) ||
        cookieValue === sessions.cookieValueOf(member.id, existing.token);
      if (!sameDevice) fail(409, `"${member.name}" is already logged in on another device. Log out there first.`, { staffName: member.name });
    }

    pinGuard.pinFails.reset(key);
    endPreviousMemberOnThisDevice(cookieValue, member.id);
    const sessionToken = sessions.start(member.id);
    bus.promoteDevice(ctx.restaurantId(), device.id, member.id);
    return {
      id: member.id, name: member.name, role: member.role, sessionToken,
      cookieValue: sessions.cookieValueOf(member.id, sessionToken),
    };
  }

  pinGuard.pinFails.fail(key);
  return fail(401, 'Invalid PIN');
}

module.exports = { pinLogin };
