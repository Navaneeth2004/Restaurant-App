'use strict';

const password = require('./providers/password');

const AUTH_METHODS = Object.freeze({ password });

module.exports = { AUTH_METHODS };
