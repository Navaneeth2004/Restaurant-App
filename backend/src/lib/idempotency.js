'use strict';
/** Remembers the answer to a request id for a few minutes, so a retry after a timeout is not applied twice. */
const TTL_MS = 10 * 60 * 1000;
const seen = new Map();

const keyOf = (rid, id) => (typeof id === 'string' && id.length >= 8 && id.length <= 64 ? `${rid}|${id}` : null);

function get(rid, id) {
  const k = keyOf(rid, id);
  const hit = k && seen.get(k);
  return hit && hit.exp > Date.now() ? hit.value : null;
}

function set(rid, id, value) {
  const k = keyOf(rid, id);
  if (!k) return;
  if (seen.size > 5000) { const now = Date.now(); for (const [key, v] of seen) if (v.exp <= now) seen.delete(key); }
  seen.set(k, { value, exp: Date.now() + TTL_MS });
}

module.exports = { get, set };
