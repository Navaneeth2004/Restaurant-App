'use strict';
/** Paths under /api that need no linked device. */
const PUBLIC = [
  /^\/health$/,
  /^\/auth\/config$/,
  /^\/auth\/owner\/(register|login)$/,
  /^\/auth\/device\/(pair|status)$/,
];

/** Kiosk sub-paths that are for STAFF (they build the QR code), not for customers. */
const KIOSK_STAFF_PATHS = ['lan-ip', 'ensure-token'];

const isPublic = (path) => PUBLIC.some(re => re.test(path));

/** The customer token of /kiosk/<token>/..., or null. */
function kioskToken(path) {
  const m = path.match(/^\/kiosk\/([^/]+)/);
  return m && !KIOSK_STAFF_PATHS.includes(m[1]) ? m[1] : null;
}

module.exports = { isPublic, kioskToken };
