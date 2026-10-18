'use strict';
/**
 * Counts failures per key and locks the key for `lockMs` after `max` failures inside `windowMs`.
 *   check(key) -> remaining lock in ms (0 = not locked) · fail(key) · reset(key)
 * Stale entries are swept once a minute so the map cannot grow forever.
 */
function failTracker({ max, windowMs, lockMs }) {
  const entries = new Map();

  const sweep = () => {
    const now = Date.now();
    for (const [key, e] of entries) {
      if (e.lockedUntil <= now && e.startedAt + windowMs <= now) entries.delete(key);
    }
  };
  setInterval(sweep, 60000).unref();

  function current(key) {
    const now = Date.now();
    let entry = entries.get(key);
    if (entry && entry.lockedUntil <= now && entry.startedAt + windowMs <= now) { entries.delete(key); entry = null; }
    if (!entry) { entry = { count: 0, startedAt: now, lockedUntil: 0 }; entries.set(key, entry); }
    return entry;
  }

  return {
    check(key) {
      const entry = entries.get(key);
      if (!entry) return 0;
      const remaining = entry.lockedUntil - Date.now();
      return remaining > 0 ? remaining : 0;
    },
    fail(key) {
      const entry = current(key);
      entry.count += 1;
      if (entry.count >= max) {
        entry.lockedUntil = Date.now() + lockMs;
        entry.count = 0;
        entry.startedAt = entry.lockedUntil;
      }
    },
    reset(key) { entries.delete(key); },
  };
}

module.exports = { failTracker };
