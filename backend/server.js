const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Attach io to every request ─────────────────────────────────────────────
const attachIo = require('./middleware/attachIo')(io);
app.use(attachIo);

// ── Static uploads ─────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/menu',       require('./routes/menu'));
app.use('/api/tables',     require('./routes/tables'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/staff',      require('./routes/staff'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/export',     require('./routes/export'));

// ── Serve React frontend build (production) ────────────────────────────────
const buildDir = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(buildDir, 'index.html'));
    }
  });
  console.log(' [Server] Serving frontend from', buildDir);
} else {
  console.log('[Server] No frontend build found. Run: cd frontend && npm run build');
  console.log('[Server] Or start React dev server separately: cd frontend && npm start');
}

// ── Socket.io ──────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log('[Socket] Connected:', socket.id);
  socket.on('disconnect', () => console.log('[Socket] Disconnected:', socket.id));
});

// ── Start: initialise DB first, then listen ────────────────────────────────
async function start() {
  // Initialise sql.js database before handling any requests
  const db = require('./db/database');
  await db.init();

  server.listen(PORT, '0.0.0.0', () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    let lanIp = null;
    for (const iface of Object.values(nets)) {
      for (const net of iface) {
        if (net.family === 'IPv4' && !net.internal) { lanIp = net.address; break; }
      }
      if (lanIp) break;
    }
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║   Restaurant APP — Server Running    ║');
    console.log('  ╠══════════════════════════════════════╣');
    console.log(`  ║  Local:   http://localhost:${PORT}      ║`);
    if (lanIp) {
    console.log(`  ║  Network: http://${lanIp}:${PORT}  ║`);
    }
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
  });
}

start().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});