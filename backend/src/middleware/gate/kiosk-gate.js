'use strict';
/** Customer QR pages: no login, but the token itself says which restaurant. Root can switch QR ordering off ("kiosk"). */
const ctx = require('../../db/context');
const { restaurantIdFromKioskToken } = require('../../lib/ids');
const access = require('../../services/restaurants/access');
const { blockedBy } = require('../../services/features/resolve');

module.exports = (token) => (req, res, next) => {
  req._smallBody = true;
  const rid = restaurantIdFromKioskToken(token);
  const restaurant = rid ? access.activeRestaurant(rid) : null;
  if (!restaurant) return res.status(404).json({ error: 'Invalid or expired QR code' });
  const block = blockedBy(restaurant, ['kiosk']);
  if (block) return res.status(403).json({ error: block.message, code: 'feature_disabled', feature: block.feature });
  req.restaurantId = rid;
  req._ctx = { restaurantId: rid, restaurant, kiosk: true };
  return ctx.run(req._ctx, next);
};
