'use strict';
const bcrypt = require('bcryptjs');

// A real hash to compare against when the account does not exist, so "unknown phone" costs the same time as "wrong password".
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

module.exports = Object.freeze({
  hash: (value) => bcrypt.hash(String(value), 12),
  async verify(value, hash) {
    const ok = await bcrypt.compare(String(value), hash || DUMMY_HASH);
    return !!hash && ok;
  },
});
