'use strict';
/** Creates the Socket.IO server and decides which room every connection joins. */
const { Server } = require('socket.io');
const cfg = require('../config/env');
const ctx = require('../db/context');
const rooms = require('./rooms');
const bus = require('./bus');
const { restaurantIdFromKioskToken } = require('../lib/ids');
const { parseCookies } = require('../lib/cookies');
const devices = require('../services/devices/devices');
const access = require('../services/restaurants/access');
const sessions = require('../services/staff/sessions');
const tables = require('../repositories/catalog/tables.repo');

function authenticate(socket, next) {
  try {
    const device = devices.find(parseCookies(socket.handshake.headers.cookie)[devices.DEVICE_COOKIE]);
    if (device) {
      const r = access.activeRestaurant(device.restaurant_id);
      if (!r) return next(new Error('unauthorized'));
      socket.data.rid = r.id;
      socket.data.deviceId = device.id;
      socket.join(rooms.device(device.id));
      socket.join(rooms.branding(r.id));
      return next();
    }
    // A customer's phone that scanned a table QR may only hear about ITS table
    const kioskToken = socket.handshake.auth && socket.handshake.auth.kiosk;
    if (kioskToken) {
      const rid = restaurantIdFromKioskToken(kioskToken);
      if (!rid || !access.activeRestaurant(rid)) return next(new Error('unauthorized'));
      const tableId = ctx.run({ restaurantId: rid }, () => tables.idByToken(kioskToken));
      if (!tableId) return next(new Error('unauthorized'));
      socket.join(rooms.table(rid, tableId));
      return next();
    }
    next(new Error('unauthorized'));
  } catch (_) { next(new Error('unauthorized')); }
}

function onConnection(socket) {
  const rid = socket.data.rid;
  if (!rid) return;

  // After the PIN is entered the browser asks to join the staff room (all live order events).
  socket.on('join_staff', (payload, ack) => {
    let ok = false;
    try {
      const staffId = Number(payload && payload.staffId);
      const token = String((payload && payload.sessionToken) || '');
      ok = !!(staffId && token && ctx.run({ restaurantId: rid }, () => sessions.validate(staffId, token)));
      if (ok) { socket.join(rooms.staff(rid)); socket.join(rooms.staffMember(rid, staffId)); }
    } catch (_) { ok = false; }
    if (typeof ack === 'function') ack({ ok });
  });
  socket.on('leave_staff', () => socket.leave(rooms.staff(rid)));
}

function createSocketServer(httpServer) {
  const corsOn = cfg.CORS_ORIGINS.length > 0;
  const io = new Server(httpServer, { cors: corsOn ? { origin: cfg.CORS_ORIGINS, credentials: true } : undefined });
  io.use(authenticate);
  io.on('connection', onConnection);
  bus.attach(io);
  return io;
}

module.exports = { createSocketServer };
