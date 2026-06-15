require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 4000;

const auth = require('./middleware/auth');
auth.init();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(auth.middleware);
app.use(require('./middleware/attachIo')(io));

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth',                require('./middleware/auth').tokenRouter());
app.use('/api/settings',            require('./routes/settings'));
app.use('/api/categories',          require('./routes/categories'));
app.use('/api/menu',                require('./routes/menu'));
app.use('/api/tables',              require('./routes/tables'));
app.use('/api/orders',              require('./routes/orders'));
app.use('/api/staff',               require('./routes/staff'));
app.use('/api/reports',             require('./routes/reports'));
app.use('/api/export/vyapar-sales', require('./routes/vyapar-sales'));
app.use('/api/export',              require('./routes/export'));

app.use('/api/backup',              require('./routes/backup'));
app.use('/api/reset',               require('./routes/reset'));
app.use('/api/bug-report', require('./routes/bug-report'));


const buildDir = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads'))
      res.sendFile(path.join(buildDir, 'index.html'));
  });
  console.log('[Server] Serving frontend from', buildDir);
} else {
  console.log('[Server] No frontend build found.');
}

io.on('connection', socket => {
  console.log('[Socket] Connected:', socket.id);
  socket.on('disconnect', () => console.log('[Socket] Disconnected:', socket.id));
});

function startMdns() {
  try {
    const { Bonjour } = require('bonjour-service');
    const bonjour = new Bonjour();
    bonjour.publish({ name: 'Restaurant POS', type: 'http', port: PORT });
    console.log('  \x1b[92m\x1b[1m[+]\x1b[0m \x1b[97mmDNS        \x1b[0m \x1b[96madvertising as restaurant.local\x1b[0m');
    process.on('exit', () => bonjour.destroy());
  } catch (_) {}
}

function getLanIp() {
  const { networkInterfaces } = require('os');
  const candidates = [];
  for (const iface of Object.values(networkInterfaces())) {
    for (const net of iface) {
      if (net.family !== 'IPv4' || net.internal) continue;
      const ip = net.address;
      if (ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip))
        candidates.push(ip);
    }
  }
  return candidates.find(ip => ip.startsWith('192.168.')) || candidates.find(ip => ip.startsWith('10.')) || candidates[0] || null;
}

async function start() {
  const db = require('./db/database');
  await db.init();

  server.listen(PORT, '0.0.0.0', () => {
    const lanIp = getLanIp();
    const c = { reset:'\x1b[0m', bold:'\x1b[1m', dim:'\x1b[2m', bGreen:'\x1b[92m', bCyan:'\x1b[96m', bYellow:'\x1b[93m', white:'\x1b[97m', gray:'\x1b[90m' };
    const G=c.bGreen+c.bold, Y=c.bYellow+c.bold, CY=c.bCyan, DIM=c.dim+c.gray, R=c.reset;
    const visLen = s => s.replace(/\x1b\[[0-9;]*m/g,'').length;
    const INNER=52;
    const row = s => `  ${DIM}║${R} ${s}${' '.repeat(Math.max(0,INNER-visLen(s)))} ${DIM}║${R}`;
    const blank=row(''), sep=`  ${DIM}╠${'═'.repeat(INNER+2)}╣${R}`;
    const top=`  ${DIM}╔${'═'.repeat(INNER+2)}╗${R}`, bot=`  ${DIM}╚${'═'.repeat(INNER+2)}╝${R}`;
    const htop=`  ${DIM}+${'─'.repeat(INNER+2)}+${R}`;
    const ok=(l,v)=>`  ${G}[+]${R} ${c.white}${l.padEnd(12)}${R} ${CY}${v}${R}`;

    console.log('');
    console.log(htop);
    console.log(row(`${Y}RESTAURANT POS${R} ${c.gray}-- Point of Sale${R}`));
    console.log(htop);
    console.log('');
    console.log(ok('Database','loaded'));
    console.log(ok('Frontend','ready'));
    console.log(ok('Socket.IO','ready'));
    console.log('');
    console.log(top); console.log(blank);
    console.log(row(`${G}>> POS IS LIVE -- Ready for orders!${R}`));
    console.log(blank); console.log(sep); console.log(blank);
    console.log(row(`${DIM}This PC   :${R} ${CY}http://localhost:${PORT}${R}`));
    if (lanIp) {
      console.log(row(`${DIM}Network   :${R} ${CY}http://${lanIp}:${PORT}${R}`));
      console.log(row(`${DIM}            ${R} ${c.gray}(use this URL on phones/tablets)${R}`));
    } else {
      console.log(row(`${Y}Network   : No LAN IP detected${R}`));
    }
    console.log(row(`${DIM}Easy URL  :${R} ${CY}http://restaurant.local:${PORT}${R}`));
    console.log(blank); console.log(sep); console.log(blank);
    console.log(row(`${Y}!! Keep this window open.${R}`));
    console.log(row(`${c.gray}   Closing it shuts down the POS.${R}`));
    console.log(blank); console.log(bot);
    console.log('');
    console.log(`  ${DIM}${'─'.repeat(22)} live log ${'─'.repeat(22)}${R}`);
    console.log('');
    startMdns();
  });
}

start().catch(err => { console.error('[Server] Failed to start:', err); process.exit(1); });