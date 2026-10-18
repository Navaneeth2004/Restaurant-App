'use strict';
/** Keep the legacy device hash column (some databases have it as NOT NULL). */
const { addColumn } = require('../../sqlite-utils');

module.exports = (db) => addColumn(db, 'devices', 'token_hash', 'TEXT');
