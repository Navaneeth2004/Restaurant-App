'use strict';
/**
 * req.io.emit(event, data) keeps working in every route file, but only reaches the
 * restaurant the request belongs to.
 *
 *   room  t:<rid>              devices where a staff member has entered a PIN   (all live events)
 *   room  t:<rid>:dev          any linked device, even before the PIN            (settings_updated only)
 *   room  t:<rid>:table:<id>   customer phones that scanned that table's QR
 *   room  d:<deviceId>         every socket of one device (used to disconnect a removed device)
 */
const ctx = require('../core/context');

const PUBLIC_EVENTS = new Set(['settings_updated']);

function emitTo(io, rid, event, data) {
  if (PUBLIC_EVENTS.has(event)) io.to(`t:${rid}:dev`).emit(event, data);
  else io.to(`t:${rid}`).emit(event, data);

  const tableId = data && (data.tableId || data.table_id ||
    (data.order && data.order.table_id) || (data.updatedOrder && data.updatedOrder.table_id));
  if (tableId && !PUBLIC_EVENTS.has(event)) io.to(`t:${rid}:table:${tableId}`).emit(event, data);
}

module.exports = (io) => (req, res, next) => {
  req.io = {
    emit(event, data) {
      const s = ctx.get();
      if (!s || !s.restaurantId) return;
      emitTo(io, s.restaurantId, event, data);
    },
    /** Kick every live connection of a device that was just removed. */
    disconnectDevice(deviceId) {
      io.in(`d:${deviceId}`).disconnectSockets(true);
    },
    promoteDevice(deviceId, restaurantId, staffId) {
      io.promoteDevice(deviceId, restaurantId, staffId);
    },
    demoteDevice(deviceId, restaurantId) {
      io.demoteDevice(deviceId, restaurantId);
    },
    demoteStaff(restaurantId, staffId) {
      io.demoteStaff(restaurantId, staffId);
    },
  };
  next();
};
module.exports.emitTo = emitTo;