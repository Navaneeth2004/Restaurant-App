'use strict';
/**
 * The route registry — ONE line per feature. To add a feature, create routes/<feature>/ and add it below.
 * assertAccessDeclared() makes the server refuse to start if any route forgot to declare
 *   - who may call it (middleware/access.js), and
 *   - for staff routes (any / floor / admin): which switchable feature it belongs to (middleware/feature.js),
 * so a new route can never be accidentally open or impossible to switch off.
 * public / device / root routes are never switchable (login, PIN screen, heartbeat, root console); the gate decides.
 */
const FEATURES = [
  ['/auth',       require('./auth')],
  ['/root',       require('./root')],
  ['/settings',   require('./catalog/settings')],
  ['/categories', require('./catalog/categories')],
  ['/menu',       require('./catalog/menu')],
  ['/tables',     require('./catalog/tables')],
  ['/parcel',     require('./catalog/parcel')],
  ['/orders',     require('./orders')],
  ['/staff',      require('./staff')],
  ['/reports',    require('./reports')],
  ['/export',     require('./export')],
  ['/bug-report', require('./bug-report')],
  ['/kiosk',      require('./kiosk')],
  ['/backup',     require('./backup')],
  ['/reset',      require('./reset')],
];

const NEEDS_FEATURE = new Set(['any', 'floor', 'admin']);

/** Throws if any route in the router (or a nested router) has no access.* or (for staff routes) no feature.of(...) middleware. */
function assertAccessDeclared(name, router) {
  for (const layer of router.stack) {
    if (layer.route) {
      const guards = layer.route.stack.map(l => l.handle).filter(Boolean);
      const method = Object.keys(layer.route.methods)[0].toUpperCase();
      const where = `${method} ${name}${layer.route.path}`;
      const access = guards.find(g => g.accessLevel);
      if (!access) throw new Error(`Route ${where} has no access declaration (middleware/access.js)`);
      if (NEEDS_FEATURE.has(access.accessLevel) && !guards.some(g => g.featureKeys)) {
        throw new Error(`Route ${where} has no feature declaration (middleware/feature.js)`);
      }
    } else if (layer.handle && layer.handle.stack) {
      assertAccessDeclared(name, layer.handle);
    }
  }
}

/** Mounts every feature under /api. */
function mountRoutes(app) {
  for (const [path, router] of FEATURES) {
    assertAccessDeclared(path, router);
    app.use(`/api${path}`, router);
  }
}

module.exports = { mountRoutes, assertAccessDeclared, FEATURES };
