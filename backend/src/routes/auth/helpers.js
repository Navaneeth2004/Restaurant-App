'use strict';
const cfg = require('../../config/env');
const { DEVICE_COOKIE, STAFF_COOKIE, cookieOptions } = require('../../lib/cookies');
const { clientMeta } = require('../../lib/http');
const { linkDevice } = require('../../services/devices/link');
const { limit } = require('../../middleware/rate-limit');

/** Links this browser to a restaurant and sets the device cookie (the old staff login is cleared). */
function linkAndSetCookie(req, res, { restaurantId, name, roleLock = null, via }) {
  const link = linkDevice({ restaurantId, name, roleLock, via, previousCookie: req.cookies[DEVICE_COOKIE], meta: clientMeta(req) });
  res.cookie(DEVICE_COOKIE, link.cookieValue, cookieOptions(cfg.DEVICE_COOKIE_DAYS));
  res.clearCookie(STAFF_COOKIE, { path: '/' });
  return link;
}

function clearLinkCookies(res) {
  res.clearCookie(DEVICE_COOKIE, { path: '/' });
  res.clearCookie(STAFF_COOKIE, { path: '/' });
}

const ipLimit = limit({ windowMs: 15 * 60 * 1000, max: 40, message: 'Too many attempts. Please wait a few minutes.' });
const registerLimit = limit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many accounts created from this network. Try again later.' });

module.exports = { linkAndSetCookie, clearLinkCookies, ipLimit, registerLimit };
