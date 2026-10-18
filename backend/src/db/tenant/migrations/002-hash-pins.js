'use strict';
/** Legacy installations stored PINs in plain text; upgrade them in place. */
const bcrypt = require('bcryptjs');
const { isHashed } = require('../../../lib/pin-rules');

module.exports = (db) => {
  const update = db.prepare('UPDATE staff SET pin = ? WHERE id = ?');
  for (const s of db.prepare('SELECT id, pin FROM staff').all()) {
    if (!isHashed(s.pin)) update.run(bcrypt.hashSync(String(s.pin), 10), s.id);
  }
};
