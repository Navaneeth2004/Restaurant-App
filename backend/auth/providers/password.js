'use strict';

const bcrypt = require('bcryptjs');

module.exports = Object.freeze({
  async hash(value) {
    return bcrypt.hash(String(value), 12);
  },
  async verify(value, hash) {
    if (!hash) return false;
    return bcrypt.compare(String(value), hash);
  },
});
