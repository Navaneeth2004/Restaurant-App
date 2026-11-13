'use strict';
const { ipKey } = require('../lib/ip');

/** Fixed-window request limiter. `key(req)` defaults to the client IP (IPv6 reduced to its /64). Stale buckets are swept every minute. */
function limit({ windowMs, max, message, key }) {
  const buckets = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.startedAt + windowMs <= now) buckets.delete(k);
  }, 60000).unref();

  return (req, res, next) => {
    const now = Date.now();
    const id = key ? key(req) : ipKey(req.ip || req.socket.remoteAddress);
    let bucket = buckets.get(id);
    if (!bucket || bucket.startedAt + windowMs <= now) { bucket = { count: 0, startedAt: now }; buckets.set(id, bucket); }
    if (bucket.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message, retry_after: retryAfter });
    }
    bucket.count += 1;
    next();
  };
}

module.exports = { limit };
