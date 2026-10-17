'use strict';
/**
 * Root console sessions + audit trail.
 * "Root" = the platform operator (you). Root accounts are rows in `owners` with role = 'root'; they can only be
 * created from the server command line (scripts/admin.js create-root), never through the website.
 * The session cookie is only sent to /api/root/* and is SameSite=Strict.
 */
const crypto = require('crypto');
const central = require('./central');
const cfg = require('./config');
const { sha256, nowIso, parseCookies } = (() => {
  const u = require('./util');
  return { sha256: u.sha256, nowIso: u.nowIso, parseCookies: require('./devices').parseCookies };
})();

const ROOT_COOKIE = 'pos_root';

function createSession(req, res, owner) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + cfg.ROOT_SESSION_HOURS * 3600000).toISOString();
  central.prepare('DELETE FROM root_sessions WHERE expires_at < ?').run(nowIso());
  central.prepare('INSERT INTO root_sessions (id, owner_id, created_at, expires_at, last_seen_at, ip, user_agent) VALUES (?,?,?,?,?,?,?)')
    .run(sha256(token), owner.id, nowIso(), expires, nowIso(), req.ip || null, String(req.headers['user-agent'] || '').slice(0, 200));
  res.cookie(ROOT_COOKIE, token, {
    httpOnly: true, secure: cfg.COOKIE_SECURE, sameSite: 'strict', path: '/api/root',
    maxAge: cfg.ROOT_SESSION_HOURS * 3600000,
  });
}

/** Returns { sessionId, owner } for a valid root session, else null. */
function findSession(req) {
  const token = (req.cookies || parseCookies(req.headers.cookie))[ROOT_COOKIE];
  if (!token) return null;
  const id = sha256(token);
  const row = central.prepare(`
    SELECT s.id, s.last_seen_at, s.expires_at, o.id AS owner_id, o.phone
    FROM root_sessions s JOIN owners o ON o.id = s.owner_id
    WHERE s.id = ? AND o.role = 'root' AND o.disabled = 0`).get(id);
  if (!row) return null;
  const now = Date.now();
  if (new Date(row.expires_at).getTime() < now) return null;
  if (now - new Date(row.last_seen_at).getTime() > cfg.ROOT_IDLE_HOURS * 3600000) return null;
  central.prepare('UPDATE root_sessions SET last_seen_at = ? WHERE id = ?').run(nowIso(), id);
  return { sessionId: id, owner: { id: row.owner_id, phone: row.phone } };
}

function destroySession(req, res) {
  const token = (req.cookies || parseCookies(req.headers.cookie))[ROOT_COOKIE];
  if (token) central.prepare('DELETE FROM root_sessions WHERE id = ?').run(sha256(token));
  res.clearCookie(ROOT_COOKIE, { path: '/api/root' });
}

function audit(req, action, target, detail) {
  const who = (req && req.root && req.root.owner) || {};
  central.prepare('INSERT INTO root_audit (at, owner_id, owner_phone, action, target, detail, ip) VALUES (?,?,?,?,?,?,?)')
    .run(nowIso(), who.id || null, who.phone || null, action, target || null,
      detail === undefined ? null : (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 2000),
      (req && req.ip) || null);
}

module.exports = { ROOT_COOKIE, createSession, findSession, destroySession, audit };