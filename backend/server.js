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

// ── Serve React frontend build (production) ────────────────────────────────
const buildDir = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  // SPA fallback — any non-API route returns index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(buildDir, 'index.html'));
    }
  });
  console.log('[Server] Serving frontend from', buildDir);
} else {
  console.log('[Server] No frontend build found. Run: cd frontend && npm run build');
  console.log('[Server] Or start React dev server separately: cd frontend && npm start');
}

// ── Socket.io ──────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log('[Socket] Connected:', socket.id);
  socket.on('disconnect', () => console.log('[Socket] Disconnected:', socket.id));
});

// ── Start — listen on 0.0.0.0 so LAN devices can reach it ─────────────────
server.listen(PORT, '0.0.0.0', () => {
  // Print LAN IP for convenience
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
  console.log('  ║   ABC Chicken POS — Server Running   ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log(`  ║  Local:   http://localhost:${PORT}      ║`);
  if (lanIp) {
  console.log(`  ║  Network: http://${lanIp}:${PORT}  ║`);
  }
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});
