'use strict';
/**
 * GET /uploads/<restaurantId>/<file> — public (customer QR pages show photos; file names are random).
 * CSP + nosniff stop an uploaded file from ever running as a page. Never creates folders.
 */
const express = require('express');
const paths = require('../services/files/paths');

const router = express.Router({ mergeParams: true });

router.use((req, res, next) => {
  const dir = paths.existingUploadsDir(req.params.rid);
  if (!dir) return res.status(404).end();
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  return express.static(dir, { index: false, dotfiles: 'deny', maxAge: '7d', fallthrough: false })(req, res, (err) => {
    if (err) return res.status(404).end();
    return next();
  });
});

module.exports = router;
