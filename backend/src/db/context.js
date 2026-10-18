'use strict';
/** Per-request tenant context (which restaurant is this code running for?). */
const { AsyncLocalStorage } = require('async_hooks');
const storage = new AsyncLocalStorage();

module.exports = {
  run(context, callback) { return storage.run(context, callback); },
  get() { return storage.getStore() || {}; },
  restaurantId() { return (storage.getStore() || {}).restaurantId || null; },
  /** Wrap a (callback-style) middleware such as multer so it runs inside the request's context. */
  wrap(middleware) {
    return (req, res, next) => {
      const context = req._ctx || storage.getStore();
      return context ? storage.run(context, () => middleware(req, res, next)) : middleware(req, res, next);
    };
  },
};
