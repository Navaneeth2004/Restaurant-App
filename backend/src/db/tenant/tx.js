'use strict';
/** Run `fn` as one atomic transaction on the current restaurant's database and return its result. */
const db = require('./index');

module.exports = (fn) => db.transaction(fn)();
