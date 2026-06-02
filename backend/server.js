const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const path    = require('path');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET','POST','PUT','PATCH','DELETE'],
    credentials: false,
  }
});

// CORS — allow all origins (local network use)
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Attach socket.io to every request
app.use((req, _res, next) => { req.io = io; next(); });

// API routes
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/menu',       require('./routes/menu'));
app.use('/api/tables',     require('./routes/tables'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/staff',      require('./routes/staff'));
app.use('/api/reports',    require('./routes/reports'));

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 404 for unknown API routes
app.use('/api/*', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Start
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   ABC Chicken POS — Backend Ready    ║`);
  console.log(`  ╠══════════════════════════════════════╣`);
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log(`  ║   API: http://localhost:${PORT}/api    ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});
