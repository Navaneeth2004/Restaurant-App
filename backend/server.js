'use strict';
/** Boot only. Everything else lives in src/. */
const cfg = require('./src/config/env');
const central = require('./src/db/central');
const tenants = require('./src/db/tenant/manager');
const owners = require('./src/repositories/central/owners.repo');
const restaurants = require('./src/repositories/central/restaurants.repo');
const { createApp } = require('./src/app');

const { server } = createApp();

server.listen(cfg.PORT, '0.0.0.0', () => {
  console.log(`\n  Restaurant POS (${cfg.DEPLOYMENT}) listening on port ${cfg.PORT}`);
  console.log(`  Data folder: ${cfg.DATA_DIR}`);
  console.log(`  ${owners.countAll()} owner(s), ${restaurants.countAll()} restaurant(s)`);
  console.log(`  Secure cookies: ${cfg.COOKIE_SECURE ? 'ON' : 'OFF (development only!)'}\n`);
});

function shutdown() {
  console.log('[Server] Shutting down…');
  server.close(() => { tenants.closeAll(); central.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
