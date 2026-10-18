'use strict';
/** Staff login sessions. Enforced on the SERVER: a session expires after STAFF_SESSION_DAYS regardless of the cookie. */
const cfg = require('../../config/env');
const ctx = require('../../db/context');
const { randomHex } = require('../../lib/crypto');
const repo = require('../../repositories/staff/staff-sessions.repo');
const bus = require('../../realtime/bus');

const TOUCH_EVERY_MS = 60 * 1000;
const HOUR = 3600000;

const cookieValueOf = (staffId, token) => `${staffId}.${token}`;

function parseCookieValue(value) {
  const v = String(value || '');
  const dot = v.indexOf('.');
  if (dot < 1) return null;
  const id = Number(v.slice(0, dot));
  const token = v.slice(dot + 1);
  return id && token ? { id, token } : null;
}

const isExpired = (row) => Date.now() - new Date(row.created_at).getTime() > cfg.STAFF_SESSION_DAYS * 24 * HOUR;

/** A session someone is actually using (not expired, active within STAFF_ACTIVE_HOURS). */
function isLive(row) {
  if (!row || isExpired(row)) return false;
  return Date.now() - new Date(row.last_seen_at || row.created_at).getTime() < cfg.STAFF_ACTIVE_HOURS * HOUR;
}

/** { id, name, role } for a valid session, else null. Also records activity (at most once a minute). */
function validateSession(staffId, token) {
  const row = repo.lookup(staffId, token);
  if (!row || isExpired(row)) return null;
  const now = Date.now();
  repo.touch(staffId, new Date(now - TOUCH_EVERY_MS).toISOString(), new Date(now).toISOString());
  return { id: row.id, name: row.name, role: row.role };
}

const validate = (staffId, token) => !!validateSession(staffId, token);

function resolveFromCookie(cookieValue) {
  const parsed = parseCookieValue(cookieValue);
  return parsed ? validateSession(parsed.id, parsed.token) : null;
}

/** Creates a fresh session (replacing any older one) and drops the member's old live connections. */
function start(staffId) {
  const token = randomHex(24);
  repo.upsert(staffId, token, new Date().toISOString());
  bus.demoteStaff(ctx.restaurantId(), staffId);
  return token;
}

/** Ends a session (logout, PIN change, deactivation) and stops its live updates. */
function end(staffId) {
  repo.remove(staffId);
  bus.demoteStaff(ctx.restaurantId(), staffId);
}

/** Logout: only the holder of the token may end the session. */
function endIfToken(staffId, token) {
  const row = repo.get(staffId);
  if (row && row.token === token) end(staffId);
}

const current = (staffId) => repo.get(staffId);

module.exports = {
  cookieValueOf, parseCookieValue, isLive, validateSession, validate, resolveFromCookie, start, end, endIfToken, current,
};
