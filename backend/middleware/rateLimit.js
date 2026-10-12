'use strict';

function limit({ windowMs, max, message }) {
  const buckets = new Map();
  let lastCleanup = 0;

  return (req, res, next) => {
    const now = Date.now();
    if (now - lastCleanup >= windowMs) {
      for (const [key, bucket] of buckets) {
        if (bucket.startedAt + windowMs <= now) buckets.delete(key);
      }
      lastCleanup = now;
    }

    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.startedAt + windowMs <= now) {
      bucket = { count: 0, startedAt: now };
      buckets.set(key, bucket);
    }
    if (bucket.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message, retry_after: retryAfter });
    }
    bucket.count += 1;
    next();
  };
}

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

module.exports = { limit, failTracker };
