'use strict';
/** Read-only counts for the root console (run inside a restaurant context). */
const db = require('../../db/tenant');

const one = (sql, ...args) => db.prepare(sql).get(...args);

function counts(today) {
  return {
    orders_total: one('SELECT COUNT(*) AS c FROM orders').c,
    orders_closed: one("SELECT COUNT(*) AS c FROM orders WHERE status = 'closed'").c,
    orders_active: one("SELECT COUNT(*) AS c FROM orders WHERE status IN ('active','delivered')").c,
    orders_today: one('SELECT COUNT(*) AS c FROM orders WHERE substr(created_at,1,10) = ?', today).c,
    staff_active: one('SELECT COUNT(*) AS c FROM staff WHERE active = 1').c,
    menu_items: one('SELECT COUNT(*) AS c FROM menu_items').c,
    categories: one('SELECT COUNT(*) AS c FROM categories').c,
    tables: one('SELECT COUNT(*) AS c FROM tables WHERE (is_archived IS NULL OR is_archived = 0)').c,
    deleted_records: one('SELECT COUNT(*) AS c FROM deleted_records').c,
  };
}

const orderSpan = () => one('SELECT MAX(created_at) AS last, MIN(created_at) AS first FROM orders');
const schemaVersion = () => db.pragma('user_version', { simple: true });

module.exports = { counts, orderSpan, schemaVersion };
