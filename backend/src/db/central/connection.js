'use strict';
const fs = require('fs');
const Database = require('better-sqlite3');
const cfg = require('../../config/env');

fs.mkdirSync(cfg.DATA_DIR, { recursive: true });
fs.mkdirSync(cfg.TENANT_DIR, { recursive: true });

const central = new Database(cfg.CENTRAL_DB);
central.pragma('journal_mode = WAL');
central.pragma('synchronous = NORMAL');
central.pragma('busy_timeout = 5000');
central.pragma('foreign_keys = ON');

module.exports = central;
