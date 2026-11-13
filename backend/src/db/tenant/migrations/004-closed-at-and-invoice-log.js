'use strict';
/** closed_at: the instant a visit was closed (every round of a visit shares it) — reports and GST are filed by it. */
const { addColumn } = require('../../sqlite-utils');

module.exports = (db) => {
  addColumn(db, 'orders', 'closed_at', 'TEXT DEFAULT NULL');
  addColumn(db, 'deleted_records', 'invoice_no', 'INTEGER DEFAULT NULL');
  db.exec(`
    UPDATE orders SET closed_at = COALESCE(delivered_at, created_at)
      WHERE status = 'closed' AND closed_at IS NULL AND session_id IS NULL;
    UPDATE orders SET closed_at = (
        SELECT MAX(COALESCE(o2.delivered_at, o2.created_at)) FROM orders o2
        WHERE o2.table_id = orders.table_id AND o2.session_id = orders.session_id AND o2.status = 'closed')
      WHERE status = 'closed' AND closed_at IS NULL AND session_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_orders_closed ON orders(status, closed_at);
  `);
};
