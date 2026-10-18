'use strict';
/** Id formats: restaurants, kiosk (QR) tokens, parcel slots. */
const crypto = require('crypto');

const UUID_RE = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const HEX10_RE = /^[a-f0-9]{10}$/i;

const newRestaurantId = () => crypto.randomBytes(5).toString('hex');
const isRestaurantId = (v) => HEX10_RE.test(String(v)) || UUID_RE.test(String(v));

/** Customer QR tokens start with the restaurant id so a public request can be routed to the right database. */
const newKioskToken = (restaurantId) => restaurantId + crypto.randomBytes(24).toString('base64url');

function restaurantIdFromKioskToken(token) {
  const t = String(token || '');
  const uuid = t.match(/^([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})/i);
  if (uuid && t.length >= uuid[1].length + 20) return uuid[1];
  return /^[a-f0-9]{10}/.test(t) && t.length >= 20 ? t.slice(0, 10) : null;
}

const isParcelId = (id) => /^P\d+$/.test(String(id));

module.exports = { newRestaurantId, isRestaurantId, newKioskToken, restaurantIdFromKioskToken, isParcelId };
