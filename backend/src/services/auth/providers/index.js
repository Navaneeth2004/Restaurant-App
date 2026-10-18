'use strict';
/** Login methods. To add one (e.g. OTP): add an entry with validateNew / hash / verify and list it in AUTH_METHODS. */
const password = require('./password');

const methods = Object.freeze({
  password: Object.freeze({
    validateNew(value) {
      const text = String(value || '');
      if (text.length < 8) return 'Password must be at least 8 characters.';
      if (Buffer.byteLength(text, 'utf8') > 72) return 'Password must be no more than 72 bytes.';
      return null;
    },
    hash: (value) => password.hash(value),
    verify: (owner, credentials) => (owner ? password.verify(credentials.password, owner.password_hash) : false),
  }),
});

module.exports = { get: (method) => methods[method] || null };
