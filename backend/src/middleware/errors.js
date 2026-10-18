'use strict';
/** Unknown API path / unexpected error: always JSON, never a stack trace. */
const { HttpError } = require('../lib/http');

const apiNotFound = (req, res) => res.status(404).json({ error: 'Not found' });

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err && String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({ error: 'That conflicts with existing data.' });
  }
  if (err && err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error('[Server] Unhandled error:', err && err.stack ? err.stack : err);
  return res.status(500).json({ error: 'Something went wrong.' });
}

module.exports = { apiNotFound, errorHandler };
