'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const storage = new AsyncLocalStorage();

module.exports = {
  run(context, callback) {
    return storage.run(context, callback);
  },
  get() {
    return storage.getStore() || {};
  },
  wrap(middleware) {
    return (req, res, next) => {
      const context = req._ctx || storage.getStore();
      return context ? storage.run(context, () => middleware(req, res, next)) : middleware(req, res, next);
    };
  },
};
