'use strict';
const tx = require('../../db/tenant/tx');
const { fail } = require('../../lib/http');
const orders = require('../../repositories/orders/orders.repo');
const orderItems = require('../../repositories/orders/order-items.repo');
const tables = require('../../repositories/catalog/tables.repo');

/** After removing an order: empty table if no open round is left, "waiting for bill" if only delivered rounds remain. */
function freeTableIfDone(order) {
  const open = orders.openInSession(order.table_id, order.session_id);
  if (open.length === 0) { tables.setStatus(order.table_id, 'empty'); return true; }
  if (!orders.activeForTable(order.table_id)) tables.setStatus(order.table_id, 'waiting_bill');
  return false;
}

function loadOpenOrder(orderId) {
  const order = orders.byId(orderId);
  if (!order) fail(404, 'Order not found');
  if (order.status === 'closed') fail(400, 'Order already closed');
  return order;
}

/** Removes one line. If it was the last line the whole order disappears. */
function cancelItem(orderId, itemId) {
  if (!itemId) fail(400, 'item_id required');
  return tx(() => {
    const order = loadOpenOrder(orderId);
    const item = orderItems.byIdInOrder(itemId, orderId);
    if (!item) fail(400, 'Item not found');

    orderItems.remove(item.id);
    orders.recalcTotal(orderId);

    if (orderItems.countForOrder(orderId) === 0) {
      orders.deleteById(orderId);
      const tableNowEmpty = freeTableIfDone(order);
      return { orderCancelled: true, tableId: order.table_id, cancelledItem: item, orderStatus: order.status, tableNowEmpty };
    }
    return { orderCancelled: false, updatedOrder: orders.withItems(orderId), cancelledItem: item, orderStatus: order.status, tableNowEmpty: false };
  });
}

/** Removes a whole kitchen round. */
function cancelRound(orderId) {
  return tx(() => {
    const order = loadOpenOrder(orderId);
    const items = orderItems.forOrder(orderId);
    orderItems.removeForOrder(orderId);
    orders.deleteById(orderId);
    const tableNowEmpty = freeTableIfDone(order);
    return { tableId: order.table_id, items, orderStatus: order.status, tableNowEmpty };
  });
}

module.exports = { cancelItem, cancelRound };
