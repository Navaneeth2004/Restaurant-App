'use strict';
/** Creates an already-delivered order and puts the table straight into "waiting for bill". */
const { v4: uuidv4 } = require('uuid');
const tx = require('../../db/tenant/tx');
const orders = require('../../repositories/orders/orders.repo');
const orderItems = require('../../repositories/orders/order-items.repo');
const tables = require('../../repositories/catalog/tables.repo');
const { isParcelId } = require('../../lib/ids');
const { normalizeItems } = require('./order-input');
const { requireTable, sessionIdForNewOrder } = require('./session');

function directBill({ tableId, items }) {
  const table = requireTable(tableId);
  const lines = normalizeItems(items);

  return tx(() => {
    const id = uuidv4();
    const now = new Date().toISOString();
    orders.insert({
      id, table_id: table.id, session_id: sessionIdForNewOrder(table), status: 'delivered',
      created_at: now, delivered_at: now, order_type: isParcelId(table.id) ? 'parcel' : 'dine_in',
    });
    tables.setStatus(table.id, 'waiting_bill');
    for (const line of lines) orderItems.insert(id, line);
    orders.recalcTotal(id);
    return orders.withItems(id);
  });
}

module.exports = { directBill };
