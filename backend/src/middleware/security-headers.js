'use strict';
const cfg = require('../config/env');

module.exports = (req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'same-origin');
  if (cfg.COOKIE_SECURE) res.set('Strict-Transport-Security', 'max-age=15552000');
  next();
};
