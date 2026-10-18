'use strict';
/**
 * Root console sessions ("root" = the platform operator). Root accounts are rows in `owners` with role = 'root'
 * and can only be created from the server command line, never through the website.
 */
const cfg = require('../../config/env');
const { randomToken, sha256 } = require('../../lib/crypto');
const sessions = require('../../repositories/central/root-sessions.repo');

const HOUR = 3600000;

/** @returns { token, maxAgeMs } — the route puts the token in the cookie */
function create(owner, meta) {
  const token = randomToken(32);
  const now = new Date().toISOString();
  sessions.purgeExpired(now);
  sessions.insert({
    id: sha256(token), ownerId: owner.id, now, ip: meta.ip, userAgent: meta.userAgent,
    expiresAt: new Date(Date.now() + cfg.ROOT_SESSION_HOURS * HOUR).toISOString(),
  });
  return { token, maxAgeMs: cfg.ROOT_SESSION_HOURS * HOUR };
}

/** { sessionId, owner: {id, phone} } for a valid, non-idle session, else null. */
function find(cookieValue) {
  if (!cookieValue) return null;
  const id = sha256(cookieValue);
  const row = sessions.find(id);
  if (!row) return null;
  const now = Date.now();
  if (new Date(row.expires_at).getTime() < now) return null;
  if (now - new Date(row.last_seen_at).getTime() > cfg.ROOT_IDLE_HOURS * HOUR) return null;
  sessions.touch(id, new Date(now).toISOString());
  return { sessionId: id, owner: { id: row.owner_id, phone: row.phone } };
}

function destroy(cookieValue) {
  if (cookieValue) sessions.remove(sha256(cookieValue));
}

module.exports = { create, find, destroy };
