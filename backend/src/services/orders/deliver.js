'use strict';
const tx = require('../../db/tenant/tx');
const { fail } = require('../../lib/http');
const orders = require('../../repositories/orders/orders.repo');
const tables = require('../../repositories/catalog/tables.repo');

/** Kitchen marks an order delivered; the table moves to "waiting for bill". Idempotent. */
function deliver(orderId) {
  const updated = tx(() => {
    const order = orders.byId(orderId);
    if (!order) return null;
    if (order.status === 'delivered') return orders.withItems(orderId);
    if (order.status !== 'active') return null;
    orders.markDelivered(orderId, new Date().toISOString());
    tables.setStatus(order.table_id, 'waiting_bill');
    return orders.withItems(orderId);
  });
  if (!updated) fail(404, 'Order not found or already closed');
  return updated;
}

/** Customer asked for the bill: deliver everything still active and flag the table. Returns delivered orders. */
function markTableDelivered(tableId) {
  return tx(() => {
    const now = new Date().toISOString();
    const delivered = orders.activeIdsForTable(tableId).map((o) => {
      orders.markDelivered(o.id, now);
      return o.id;
    });
    tables.setStatus(tableId, 'waiting_bill');
    return delivered.map((id) => orders.withItems(id));
  });
}

module.exports = { deliver, markTableDelivered };
