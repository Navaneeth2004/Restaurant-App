'use strict';
/** Links a browser to a restaurant: creates the device row and returns the cookie value to set. */
const { randomToken, uuid, sha256 } = require('../../lib/crypto');
const { guessDeviceName } = require('../../lib/device-name');
const { clip } = require('../../lib/input');
const devices = require('../../repositories/central/devices.repo');
const deviceService = require('./devices');

/**
 * @param previousCookie the browser's current device cookie, if any (that old link is retired)
 * @param meta           { ip, userAgent }
 * @returns { id, name, cookieValue }
 */
function linkDevice({ restaurantId, name, roleLock = null, via, previousCookie, meta }) {
  const now = new Date().toISOString();
  const previous = deviceService.find(previousCookie);
  if (previous) devices.revokeAny(previous.id, now);

  const id = uuid();
  const secret = randomToken(32);
  const deviceName = clip(name, 40) || guessDeviceName(meta.userAgent);
  devices.insert({
    id, restaurantId, name: deviceName, secretHash: sha256(secret), roleLock, via, now,
    ip: meta.ip, userAgent: meta.userAgent,
  });
  return { id, name: deviceName, cookieValue: `${id}.${secret}` };
}

module.exports = { linkDevice };
