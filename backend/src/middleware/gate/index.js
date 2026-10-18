'use strict';
/**
 * The access gate for everything under /api. It only answers "which restaurant is this, and who is calling?";
 * what each caller may DO is declared per route (middleware/access.js).
 *   /root/*            root console session
 *   /kiosk/<token>/*   customer QR token
 *   public paths       owner login/register, device pairing/status, health
 *   everything else    linked device (+ optional staff PIN session)
 */
const { parseCookies } = require('../../lib/cookies');
const { isPublic, kioskToken } = require('./public-paths');
const rootGate = require('./root-gate');
const makeKioskGate = require('./kiosk-gate');
const deviceGate = require('./device-gate');

module.exports = (req, res, next) => {
  req.cookies = parseCookies(req.headers.cookie);
  const p = req.path;
  if (p.startsWith('/root/')) return rootGate(req, res, next);

  const token = kioskToken(p);
  if (token) return makeKioskGate(token)(req, res, next);

  if (isPublic(p)) { req._smallBody = true; return next(); }
  return deviceGate(req, res, next);
};
