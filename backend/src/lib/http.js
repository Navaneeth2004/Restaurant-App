'use strict';
/** HttpError: throw it from anywhere (services included); the error middleware turns it into JSON. */
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

/** Wrap a route handler so sync throws AND rejected promises reach the error middleware. */
const handle = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof out.catch === 'function') out.catch(next);
  } catch (e) { next(e); }
};

/** Who is calling: the only request details services ever need. */
const clientMeta = (req) => ({ ip: req.ip || null, userAgent: String(req.headers['user-agent'] || '').slice(0, 200) });

module.exports = { HttpError, fail, handle, clientMeta };
