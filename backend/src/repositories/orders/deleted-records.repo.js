'use strict';
const db = require('../../db/tenant');

const insert = (r) => db.prepare(`
  INSERT INTO deleted_records
    (deleted_at, deleted_by, table_id, table_label, visit_at, order_count, subtotal, bill_total, amount_paid,
     payment_method, order_type, customer_name, customer_phone, customer_gstin, was_edited, edited_at, items_json)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .run(r.deletedAt, r.deletedBy, r.tableId, r.tableLabel, r.visitAt, r.orderCount, r.subtotal, r.billTotal, r.amountPaid,
    r.paymentMethod, r.orderType, r.customerName, r.customerPhone, r.customerGstin, r.wasEdited, r.editedAt, r.itemsJson);

const list = (limit) => db.prepare('SELECT * FROM deleted_records ORDER BY id DESC LIMIT ?').all(limit);
const deleteAll = () => db.prepare('DELETE FROM deleted_records').run();
const tableLabel = (tableId) => (db.prepare('SELECT label FROM tables WHERE id = ?').get(tableId) || {}).label || null;

module.exports = { insert, list, deleteAll, tableLabel };
