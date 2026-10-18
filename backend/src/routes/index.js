'use strict';
/**
 * The route registry — ONE line per feature. To add a feature, create routes/<feature>/ and add it below.
 * assertAccessDeclared() makes the server refuse to start if any route forgot to declare who may call it
 * (middleware/access.js), so a new route can never be accidentally open.
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

/** Throws if any route in the router (or a nested router) has no access.* middleware. */
function assertAccessDeclared(name, router) {
  for (const layer of router.stack) {
    if (layer.route) {
      const declared = layer.route.stack.some(l => l.handle && l.handle.accessLevel);
      if (!declared) {
        const method = Object.keys(layer.route.methods)[0].toUpperCase();
        throw new Error(`Route ${method} ${name}${layer.route.path} has no access declaration (middleware/access.js)`);
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

module.exports = { mountRoutes, FEATURES };
