'use strict';

const crypto = require('crypto');

module.exports = function generateKioskToken() {
  return crypto.randomBytes(24).toString('base64url');
};
