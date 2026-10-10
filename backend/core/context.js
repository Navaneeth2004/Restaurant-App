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
};
