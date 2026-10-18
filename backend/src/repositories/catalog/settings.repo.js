'use strict';
const db = require('../../db/tenant');
const { DEFAULT_SETTINGS } = require('../../config/defaults');

/** Every setting, falling back to the default for keys never saved. */
const all = () => ({
  ...DEFAULT_SETTINGS,
  ...Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])),
});

function get(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : (DEFAULT_SETTINGS[key] ?? null);
}

const set = (key, value) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));

const setMany = (obj) => db.transaction(() => { for (const [k, v] of Object.entries(obj)) set(k, v); })();

/** The tax rate in percent (5 = 5%). */
function taxPercent() {
  const n = parseFloat(get('tax_percent'));
  return Number.isFinite(n) ? n : 5;
}

module.exports = { all, get, set, setMany, taxPercent };
