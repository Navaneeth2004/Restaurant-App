'use strict';
/** Boot only. Everything else lives in src/. */
const cfg = require('./src/config/env');
const central = require('./src/db/central');
const tenants = require('./src/db/tenant/manager');
const owners = require('./src/repositories/central/owners.repo');
const restaurants = require('./src/repositories/central/restaurants.repo');
const { createApp } = require('./src/app');

// ── safety checks for a public (cloud) deployment ──
if (cfg.DEPLOYMENT === 'cloud') {
  if (cfg.IS_PROD && !cfg.COOKIE_SECURE && !cfg.ALLOW_INSECURE_COOKIES) {
    throw new Error('Refusing to start: production without secure cookies. Serve over HTTPS (COOKIE_SECURE=true) or set ALLOW_INSECURE_COOKIES=true to override.');
  }
  if (!cfg.IS_PROD) console.warn('[Server] WARNING: DEPLOYMENT=cloud but NODE_ENV is not "production": cookies are not Secure and HSTS is off.');
  if (!cfg.TRUST_PROXY) {
    console.warn('[Server] WARNING: TRUST_PROXY is not set. Behind nginx/Cloudflare every visitor then shares the proxy\'s IP (shared lockouts and rate limits). Set TRUST_PROXY=<number of proxy hops>.');
  }
}

const { server, io } = createApp();

server.listen(cfg.PORT, '0.0.0.0', () => {
  console.log(`\n  Restaurant POS (${cfg.DEPLOYMENT}) listening on port ${cfg.PORT}`);
  console.log(`  Data folder: ${cfg.DATA_DIR}`);
  console.log(`  ${owners.countAll()} owner(s), ${restaurants.countAll()} restaurant(s)`);
  console.log(`  Secure cookies: ${cfg.COOKIE_SECURE ? 'ON' : 'OFF (development only!)'}\n`);
});

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  console.log('[Server] Shutting down…');
  const done = () => { tenants.closeAll(); central.close(); process.exit(code); };
  io.close(done);                       // closes sockets AND the http server, so this no longer waits for the 5 s timeout
  setTimeout(() => process.exit(code), 5000).unref();
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('unhandledRejection', (reason) => { console.error('[Server] Unhandled rejection:', reason); });
process.on('uncaughtException', (err) => { console.error('[Server] Uncaught exception:', err); shutdown(1); });
