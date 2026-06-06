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

// ── Auth (shared-secret token) ────────────────────────────────────────────
const auth = require('./middleware/auth');
auth.init();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth check on every API request (before routes)
app.use(auth.middleware);

// ── Attach io to every request ─────────────────────────────────────────────
const attachIo = require('./middleware/attachIo')(io);
app.use(attachIo);

// ── Static uploads ─────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── Auth token endpoint (unauthenticated — lets browser bootstrap itself) ──
app.use('/api/auth', auth.tokenRouter());

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/settings',        require('./routes/settings'));
app.use('/api/categories',      require('./routes/categories'));
app.use('/api/menu',            require('./routes/menu'));
app.use('/api/tables',          require('./routes/tables'));
app.use('/api/orders',          require('./routes/orders'));
app.use('/api/staff',           require('./routes/staff'));
app.use('/api/reports',         require('./routes/reports'));
app.use('/api/export',          require('./routes/export'));
app.use('/api/export/vyapar',   require('./routes/vyapar'));   // ← FIX: was missing

// ── Serve React frontend build (production) ────────────────────────────────
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
  console.log('[Server] No frontend build found. Run: cd frontend && npm run build');
}

// ── Socket.io ──────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log('[Socket] Connected:', socket.id);
  socket.on('disconnect', () => console.log('[Socket] Disconnected:', socket.id));
});

// ── mDNS / Bonjour — broadcast as restaurant.local ────────────────────────
function startMdns() {
  try {
    const { Bonjour } = require('bonjour-service');
    const bonjour = new Bonjour();
    bonjour.publish({ name: 'Restaurant POS', type: 'http', port: PORT });
    console.log(`  \x1b[92m\x1b[1m[+]\x1b[0m \x1b[97mmDNS        \x1b[0m \x1b[96madvertising as restaurant.local\x1b[0m`);
    process.on('exit', () => bonjour.destroy());
  } catch (_) {
    // bonjour-service not installed — mDNS just won't be available
  }
}

// ── Start: initialise DB first, then listen ────────────────────────────────
async function start() {
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

    const c = {
      reset:   '\x1b[0m',
      bold:    '\x1b[1m',
      dim:     '\x1b[2m',
      bGreen:  '\x1b[92m',
      bCyan:   '\x1b[96m',
      bYellow: '\x1b[93m',
      white:   '\x1b[97m',
      gray:    '\x1b[90m',
    };
    const G   = c.bGreen  + c.bold;
    const Y   = c.bYellow + c.bold;
    const CY  = c.bCyan;
    const DIM = c.dim + c.gray;
    const R   = c.reset;

    const visLen = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;
    const INNER = 52;
    const row = (styledStr) => {
      const spaces = INNER - visLen(styledStr);
      return `  ${DIM}║${R} ${styledStr}${' '.repeat(Math.max(0, spaces))} ${DIM}║${R}`;
    };
    const blank = row('');
    const sep   = `  ${DIM}╠${'═'.repeat(INNER + 2)}╣${R}`;
    const top   = `  ${DIM}╔${'═'.repeat(INNER + 2)}╗${R}`;
    const bot   = `  ${DIM}╚${'═'.repeat(INNER + 2)}╝${R}`;
    const htop  = `  ${DIM}+${'─'.repeat(INNER + 2)}+${R}`;
    const ok    = (label, val) =>
      `  ${G}[+]${R} ${c.white}${label.padEnd(12)}${R} ${CY}${val}${R}`;

    console.log('');
    console.log(htop);
    console.log(row(`${Y}RESTAURANT POS${R} ${c.gray}-- Point of Sale${R}`));
    console.log(htop);
    console.log('');
    console.log(ok('Database',  'loaded'));
    console.log(ok('Frontend',  'ready'));
    console.log(ok('Socket.IO', 'ready'));
    console.log('');
    console.log(top);
    console.log(blank);
    console.log(row(`${G}>> POS IS LIVE -- Ready for orders!${R}`));
    console.log(blank);
    console.log(sep);
    console.log(blank);
    console.log(row(`${DIM}This PC   :${R} ${CY}http://localhost:${PORT}${R}`));
    if (lanIp) {
      console.log(row(`${DIM}Network   :${R} ${CY}http://${lanIp}:${PORT}${R}`));
    }
    console.log(row(`${DIM}Easy URL  :${R} ${CY}http://restaurant.local:${PORT}${R}`));
    console.log(blank);
    console.log(sep);
    console.log(blank);
    console.log(row(`${Y}!! Keep this window open.${R}`));
    console.log(row(`${c.gray}   Closing it shuts down the POS.${R}`));
    console.log(blank);
    console.log(bot);
    console.log('');
    console.log(`  ${DIM}${'─'.repeat(22)} live log ${'─'.repeat(22)}${R}`);
    console.log('');

    startMdns();
  });
}

start().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});