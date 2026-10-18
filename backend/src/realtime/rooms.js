'use strict';
/**
 * Socket.IO room names (one place, so nothing else builds strings by hand).
 *   staff(rid)         devices where a staff member entered a PIN  -> all live events
 *   branding(rid)      any linked device, even before the PIN       -> settings_updated only
 *   table(rid, id)     customer phones that scanned that table's QR
 *   device(id)         every socket of one device                   -> used to disconnect a removed device
 *   staffMember(rid,id) every socket of one staff member            -> used to demote on logout/deactivation
 */
module.exports = {
  staff: (rid) => `t:${rid}`,
  branding: (rid) => `t:${rid}:dev`,
  table: (rid, tableId) => `t:${rid}:table:${tableId}`,
  device: (deviceId) => `d:${deviceId}`,
  staffMember: (rid, staffId) => `s:${rid}:${staffId}`,
};
