const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const path    = require('path');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE'], credentials: false }
});

// CORS - allow all (local network)
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (images + logos) with permissive headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'public, max-age=86400');
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

// Attach socket.io to every request
app.use((req, _res, next) => { req.io = io; next(); });

// Routes
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/menu',       require('./routes/menu'));
app.use('/api/tables',     require('./routes/tables'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/staff',      require('./routes/staff'));
app.use('/api/reports',    require('./routes/reports'));

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Start
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ╔═══════════════════════════════════════╗');
  console.log(`  ║   Restaurant POS — Backend Ready      ║`);
  console.log(`  ╠═══════════════════════════════════════╣`);
  console.log(`  ║   Local:  http://localhost:${PORT}         ║`);
  console.log(`  ║   Health: http://localhost:${PORT}/api/health ║`);
  console.log('  ╚═══════════════════════════════════════╝\n');
});
