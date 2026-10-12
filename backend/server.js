'use strict';
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const cfg = require('./core/config');
const central = require('./core/central');          // creates DATA_DIR + accounts.db
const tenants = require('./core/tenants');
const ctx = require('./core/context');
const db = require('./db/database');
const files = require('./core/files');
const { gate } = require('./middleware/auth');
const attachIo = require('./middleware/attachIo');
const {
  DEVICE_COOKIE, STAFF_COOKIE, parseCookies, findDevice, activeRestaurant,
} = require('./core/devices');
const { resolveStaff } = require('./core/staff-auth');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

app.disable('x-powered-by');
if (cfg.TRUST_PROXY) app.set('trust proxy', cfg.TRUST_PROXY);

const corsOn = cfg.CORS_ORIGINS.length > 0;
const io = new Server(server, {
  cors: corsOn ? { origin: cfg.CORS_ORIGINS, credentials: true } : undefined,
});

// ── Basic security headers ────────────────────────────────────────────────
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'same-origin');
  if (cfg.COOKIE_SECURE) res.set('Strict-Transport-Security', 'max-age=15552000');
  next();
});
app.use(cors(corsOn ? { origin: cfg.CORS_ORIGINS, credentials: true } : { origin: false }));

// ── API: gate first (device + staff), then body parsing ───────────────────
// Public/unauthenticated endpoints get a tiny body limit; logged-in ones 10 MB
// (bug reports can include a screenshot).
const smallJson = express.json({ limit: '20kb' });
const bigJson   = express.json({ limit: '10mb' });
const bigForm   = express.urlencoded({ limit: '10mb', extended: true });

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', gate);
app.use('/api', (req, res, next) => (req._smallBody ? smallJson : bigJson)(req, res, next));
app.use('/api', (req, res, next) => (req._smallBody ? next() : bigForm(req, res, next)));
app.use('/api', attachIo(io));

// Restaurant uploads use opaque names under each restaurant's own directory.
app.get('/uploads/:restaurantId/:name', (req, res) => {
  if (!files.isRestaurantId(req.params.restaurantId)) return res.sendStatus(404);
  const file = files.resolveUpload(req.params.restaurantId, req.params.name);
  if (!file || !fs.existsSync(file)) return res.sendStatus(404);
  res.sendFile(file);
});

// ── Realtime: every socket is placed in its restaurant's room ─────────────
io.use((socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const device = findDevice(cookies[DEVICE_COOKIE]);
    if (device) {
      const r = activeRestaurant(device.restaurant_id);
      if (!r || !r.active) return next(new Error('unauthorized'));
      socket.data.deviceId = device.id;
      socket.data.restaurantId = r.id;
      socket.data.roleLock = device.role_lock;
      socket.join(`d:${device.id}`);
      socket.join(`t:${r.id}:dev`);
      const staff = ctx.run({ restaurantId: r.id, device }, () => resolveStaff(cookies[STAFF_COOKIE]));
      if (staff) {
        socket.data.staffId = staff.id;
        socket.join(`t:${r.id}`);
      }
      return next();
    }
    // Customer phone that scanned a table QR: it may only hear about ITS table
    const kt = socket.handshake.auth && socket.handshake.auth.kiosk;
    if (kt) {
      const rid = tenants.restaurantIdFromKioskToken(kt);
      const restaurant = rid ? activeRestaurant(rid) : null;
      if (!restaurant || !restaurant.active) return next(new Error('unauthorized'));
      const row = ctx.run({ restaurantId: rid }, () =>
        db.prepare('SELECT id FROM tables WHERE kiosk_token = ?').get(kt));
      if (!row) return next(new Error('unauthorized'));
      socket.data.restaurantId = rid;
      socket.data.tableId = row.id;
      socket.join(`t:${rid}:table:${row.id}`);
      return next();
    }
    next(new Error('unauthorized'));
  } catch (err) {
    console.error('[Socket] Authentication error:', err.message);
    next(new Error('unauthorized'));
  }
});

io.promoteDevice = (deviceId, restaurantId, staffId) => {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.deviceId === deviceId && socket.data.restaurantId === restaurantId) {
      socket.data.staffId = staffId;
      socket.join(`t:${restaurantId}`);
    }
  }
};
io.demoteDevice = (deviceId, restaurantId) => {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.deviceId === deviceId && socket.data.restaurantId === restaurantId) {
      socket.data.staffId = null;
      socket.leave(`t:${restaurantId}`);
    }
  }
};
io.demoteStaff = (restaurantId, staffId) => {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.restaurantId === restaurantId && socket.data.staffId === staffId) {
      socket.data.staffId = null;
      socket.leave(`t:${restaurantId}`);
    }
  }
};
io.revokeDevice = (deviceId) => {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.deviceId === deviceId) socket.disconnect(true);
  }
};
io.on('connection', (socket) => {
  socket.on('staff:join', ({ staffId, sessionToken } = {}, acknowledge) => {
    const restaurantId = socket.data.restaurantId;
    if (!restaurantId || !socket.data.deviceId) {
      if (typeof acknowledge === 'function') acknowledge({ ok: false });
      return;
    }
    const staff = ctx.run({ restaurantId }, () => resolveStaff(`${staffId}.${sessionToken}`));
    if (!staff || (socket.data.roleLock && staff.role !== socket.data.roleLock && staff.role !== 'admin')) {
      if (typeof acknowledge === 'function') acknowledge({ ok: false });
      return;
    }
    socket.data.staffId = staff.id;
    socket.join(`t:${restaurantId}`);
    if (typeof acknowledge === 'function') acknowledge({ ok: true });
  });
  socket.on('staff:leave', () => {
    const { restaurantId, staffId } = socket.data;
    if (!restaurantId || !staffId) return;
    socket.leave(`t:${restaurantId}`);
    socket.data.staffId = null;
  });
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/menu',       require('./routes/menu'));
app.use('/api/tables',     require('./routes/tables'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/staff',      require('./routes/staff'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/export',     require('./routes/export'));
app.use('/api/parcel',     require('./routes/parcel'));
app.use('/api/bug-report', require('./routes/bug-report'));
app.use('/api/kiosk',      require('./routes/kiosk'));

app.use('/api/backup', require('./routes/backup'));
app.use('/api/reset',  require('./routes/reset'));

// ── Frontend (single page app) ────────────────────────────────────────────
const buildDir = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(buildDir, 'index.html'));
    }
  });
  console.log('[Server] Serving frontend from', buildDir);
} else {
  console.log('[Server] No frontend build found.');
}

// Unknown API path / unexpected error: always JSON, never a stack trace
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Something went wrong.' });
});

server.listen(PORT, '0.0.0.0', () => {
  const owners = central.prepare('SELECT COUNT(*) AS c FROM owners').get().c;
  const rests  = central.prepare('SELECT COUNT(*) AS c FROM restaurants').get().c;
  console.log(`\n  Restaurant POS (${cfg.DEPLOYMENT}) listening on port ${PORT}`);
  console.log(`  Data folder: ${cfg.DATA_DIR}`);
  console.log(`  ${owners} owner(s), ${rests} restaurant(s)`);
  console.log(`  Secure cookies: ${cfg.COOKIE_SECURE ? 'ON' : 'OFF (development only!)'}\n`);
});

function shutdown() {
  console.log('[Server] Shutting down…');
  server.close(() => { tenants.closeAll(); central.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);