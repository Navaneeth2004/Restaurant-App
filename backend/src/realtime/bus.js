'use strict';
/**
 * The single handle on Socket.IO for the rest of the app. Every call is a safe no-op when no server is
 * attached (CLI, tests), so services can use it without caring.
 */
const rooms = require('./rooms');

const PUBLIC_EVENTS = new Set(['settings_updated']);
let io = null;

const attach = (server) => { io = server; };
const getIo = () => io;

/** Sends an event to the restaurant's staff (and to the table's customers when the payload names a table). */
function emit(rid, event, data) {
  if (!io || !rid) return;
  if (PUBLIC_EVENTS.has(event)) { io.to(rooms.branding(rid)).emit(event, data); return; }
  io.to(rooms.staff(rid)).emit(event, data);
  const tableId = data && (data.tableId || data.table_id ||
    (data.order && data.order.table_id) || (data.updatedOrder && data.updatedOrder.table_id));
  if (tableId) io.to(rooms.table(rid, tableId)).emit(event, data);
}

const kickRestaurant = (rid) => {
  if (!io) return;
  io.in(rooms.staff(rid)).disconnectSockets(true);
  io.in(rooms.branding(rid)).disconnectSockets(true);
};
const disconnectDevice = (deviceId) => { if (io) io.in(rooms.device(deviceId)).disconnectSockets(true); };

/** Stop sending live order events to every socket of this staff member. */
const demoteStaff = (rid, staffId) => {
  if (io) io.in(rooms.staffMember(rid, staffId)).socketsLeave([rooms.staff(rid), rooms.staffMember(rid, staffId)]);
};
/** Stop sending live order events to every socket of this device. */
const demoteDevice = (rid, deviceId) => { if (io) io.in(rooms.device(deviceId)).socketsLeave(rooms.staff(rid)); };
/** Start sending live order events to every socket of this device. */
const promoteDevice = (rid, deviceId, staffId) => {
  if (io) io.in(rooms.device(deviceId)).socketsJoin([rooms.staff(rid), rooms.staffMember(rid, staffId)]);
};

const connectedCount = () => (io ? io.engine.clientsCount : null);
const roomSize = (room) => (io ? (io.sockets.adapter.rooms.get(room) || new Set()).size : 0);

module.exports = {
  attach, getIo, emit, kickRestaurant, disconnectDevice, demoteStaff, demoteDevice, promoteDevice, connectedCount, roomSize,
};
