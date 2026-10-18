'use strict';
/** Columns that older databases may lack (applied by migration 001, idempotent). */
module.exports = {
  menu_items: [['sort_order', 'INTEGER DEFAULT 0']],
  tables: [
    ['session_id', 'TEXT DEFAULT NULL'], ['kiosk_token', 'TEXT DEFAULT NULL'],
    ['is_parcel', 'INTEGER DEFAULT 0'], ['is_archived', 'INTEGER DEFAULT 0'],
    ['customer_name', 'TEXT DEFAULT NULL'], ['customer_phone', 'TEXT DEFAULT NULL'],
  ],
  orders: [
    ['payment_method', 'TEXT DEFAULT NULL'], ['payment_details', 'TEXT DEFAULT NULL'],
    ['change_amount', 'REAL DEFAULT 0'], ['customer_name', 'TEXT DEFAULT NULL'],
    ['customer_phone', 'TEXT DEFAULT NULL'], ['session_id', 'TEXT DEFAULT NULL'],
    ['amount_paid', 'REAL DEFAULT NULL'], ['order_type', "TEXT DEFAULT 'dine_in'"],
    ['customer_gstin', 'TEXT DEFAULT NULL'], ['tax_percent_snapshot', 'REAL DEFAULT NULL'],
    ['edited_at', 'TEXT DEFAULT NULL'],
  ],
};
