'use strict';

function failTracker({ max, windowMs, lockMs }) {
  const entries = new Map();

  function current(key) {
    const now = Date.now();
    let entry = entries.get(key);
    if (entry && entry.lockedUntil <= now && entry.startedAt + windowMs <= now) {
      entries.delete(key);
      entry = null;
    }
    if (!entry) {
      entry = { count: 0, startedAt: now, lockedUntil: 0 };
      entries.set(key, entry);
    }
    return entry;
  }

  return {
    check(key) {
      const entry = entries.get(key);
      if (!entry) return 0;
      const remaining = entry.lockedUntil - Date.now();
      if (remaining > 0) return remaining;
      if (entry.startedAt + windowMs <= Date.now()) entries.delete(key);
      return 0;
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
    reset(key) {
      entries.delete(key);
    },
  };
}

module.exports = { failTracker };
