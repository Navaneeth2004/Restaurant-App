'use strict';
/**
 * Builds the HTTP app. Middleware ORDER matters:
 *   security headers/CORS -> health -> gate (device/staff/kiosk/root) -> body parsers -> tenant context
 *   -> req.io -> routes -> frontend -> API 404 -> error handler
 */
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const cfg = require('./config/env');
const securityHeaders = require('./middleware/security-headers');
const gate = require('./middleware/gate');
const bodyParsers = require('./middleware/body-parsers');
const tenantContext = require('./middleware/tenant-context');
const attachIo = require('./middleware/attach-io');
const { apiNotFound, errorHandler } = require('./middleware/errors');
const { createSocketServer } = require('./realtime/socket-server');
const { mountRoutes } = require('./routes');

const FRONTEND_BUILD = path.join(__dirname, '..', '..', 'frontend', 'build');

function serveFrontend(app) {
  if (!fs.existsSync(FRONTEND_BUILD)) { console.log('[Server] No frontend build found.'); return; }
  app.use(express.static(FRONTEND_BUILD));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    return res.sendFile(path.join(FRONTEND_BUILD, 'index.html'));
  });
  console.log('[Server] Serving frontend from', FRONTEND_BUILD);
}

/** @returns { app, server, io } */
function createApp() {
  const app = express();
  const server = http.createServer(app);
  const corsOn = cfg.CORS_ORIGINS.length > 0;

  app.disable('x-powered-by');
  if (cfg.TRUST_PROXY) app.set('trust proxy', cfg.TRUST_PROXY);
  app.use(securityHeaders);
  app.use(cors(corsOn ? { origin: cfg.CORS_ORIGINS, credentials: true } : { origin: false }));

  const io = createSocketServer(server);
  app.set('io', io);

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', gate, bodyParsers, tenantContext, attachIo);
  app.use('/uploads/:rid', require('./routes/uploads'));
  mountRoutes(app);

  serveFrontend(app);
  app.use('/api', apiNotFound);
  app.use(errorHandler);
  return { app, server, io };
}

module.exports = { createApp };
