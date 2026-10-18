'use strict';
/** Customer QR pages: no login, but the token itself says which restaurant. */
const ctx = require('../../db/context');
const { restaurantIdFromKioskToken } = require('../../lib/ids');
const access = require('../../services/restaurants/access');

module.exports = (token) => (req, res, next) => {
  req._smallBody = true;
  const rid = restaurantIdFromKioskToken(token);
  if (!rid || !access.activeRestaurant(rid)) return res.status(404).json({ error: 'Invalid or expired QR code' });
  req.restaurantId = rid;
  req._ctx = { restaurantId: rid, kiosk: true };
  return ctx.run(req._ctx, next);
};
