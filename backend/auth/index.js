'use strict';

const password = require('./providers/password');

const methods = Object.freeze({
  password: Object.freeze({
    validateNew(value) {
      const text = String(value || '');
      if (text.length < 8) return 'Password must be at least 8 characters.';
      if (Buffer.byteLength(text, 'utf8') > 72) return 'Password must be no more than 72 bytes.';
      return null;
    },
    hash(value) {
      return password.hash(value);
    },
    verify(owner, credentials) {
      return owner ? password.verify(credentials.password, owner.password_hash) : false;
    },
  }),
});

module.exports = {
  methods: Object.freeze(Object.keys(methods)),
  get(method) {
    return methods[method] || null;
  },
};
