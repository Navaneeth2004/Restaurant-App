'use strict';
/** Short GST invoice numbers, staff-session activity tracking, and indexes for the hot queries. */
const { addColumn } = require('../../sqlite-utils');

module.exports = (db) => {
  addColumn(db, 'orders', 'invoice_no', 'INTEGER DEFAULT NULL');
  addColumn(db, 'staff_sessions', 'last_seen_at', 'TEXT');
  db.exec(`
    UPDATE staff_sessions SET last_seen_at = created_at WHERE last_seen_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_orders_table_session ON orders(table_id, session_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `);
};
