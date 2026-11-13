'use strict';
/**
 * Counts failures per key and locks the key after `max` failures inside `windowMs`.
 * With `escalate`, every further lock doubles (up to `maxLockMs`) while the key keeps failing.
 *   check(key) -> remaining lock in ms (0 = not locked) · fail(key) · reset(key)
 */
function failTracker({ max, windowMs, lockMs, maxLockMs = lockMs, escalate = false }) {
  const entries = new Map();
  const MEMORY = windowMs * 6;

  setInterval(() => {
    const now = Date.now();
    for (const [key, e] of entries) {
      if (e.lockedUntil <= now && e.startedAt + windowMs <= now && e.memoryUntil <= now) entries.delete(key);
    }
  }, 60000).unref();

  function current(key) {
    const now = Date.now();
    let e = entries.get(key);
    if (e && e.lockedUntil <= now && e.startedAt + windowMs <= now) {
      if (e.strikes > 0 && now < e.memoryUntil) { e.count = 0; e.startedAt = now; } else { entries.delete(key); e = null; }
    }
    if (!e) { e = { count: 0, startedAt: now, lockedUntil: 0, strikes: 0, memoryUntil: 0 }; entries.set(key, e); }
    return e;
  }

  return {
    check(key) {
      const e = entries.get(key);
      if (!e) return 0;
      const remaining = e.lockedUntil - Date.now();
      return remaining > 0 ? remaining : 0;
    },
    fail(key) {
      const e = current(key);
      e.count += 1;
      if (e.count >= max) {
        const lock = Math.min(lockMs * (escalate ? 2 ** Math.min(e.strikes, 10) : 1), maxLockMs);
        e.lockedUntil = Date.now() + lock;
        if (escalate) { e.strikes += 1; e.memoryUntil = e.lockedUntil + MEMORY; }
        e.count = 0;
        e.startedAt = e.lockedUntil;
      }
    },
    reset(key) { entries.delete(key); },
  };
}

module.exports = { failTracker };
