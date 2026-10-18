'use strict';
/**
 * The socket events that describe order changes. Routes call these with `req.io`; event names and
 * payloads are the contract with the frontend, so they live in ONE file.
 */
const tablesChanged = (io) => io.emit('tables_updated');

function orderSubmitted(io, { order, isNew, additions }) {
  if (isNew) {
    io.emit('new_order', { order });
    io.emit('order_updated', { order, isNew: true });
  } else {
    io.emit('order_updated', { order, isNew: false });
    io.emit('order_additions', { orderId: order.id, tableId: order.table_id, additions, createdAt: new Date().toISOString() });
  }
  tablesChanged(io);
}

function orderDelivered(io, order) {
  io.emit('order_delivered', { order });
  tablesChanged(io);
}

const orderClosed = (io, orderId, tableId) => io.emit('order_closed', { orderId, tableId });

function itemCancelled(io, orderId, r) {
  if (r.orderCancelled) {
    io.emit('order_item_cancelled', {
      orderId, tableId: r.tableId, cancelledItem: r.cancelledItem, orderStatus: r.orderStatus,
      updatedOrder: { id: orderId, table_id: r.tableId, items: [] }, tableNowEmpty: r.tableNowEmpty,
    });
    if (r.tableNowEmpty) orderClosed(io, orderId, r.tableId);
    tablesChanged(io);
    return;
  }
  io.emit('order_updated', { order: r.updatedOrder, isNew: false });
  io.emit('order_item_cancelled', {
    orderId, tableId: r.updatedOrder.table_id, cancelledItem: r.cancelledItem, orderStatus: r.orderStatus,
    updatedOrder: r.updatedOrder, tableNowEmpty: false,
  });
}

function roundCancelled(io, orderId, r) {
  if (r.tableNowEmpty) orderClosed(io, orderId, r.tableId);
  tablesChanged(io);
  io.emit('order_round_cancelled', {
    orderId, tableId: r.tableId, cancelledItems: r.items, orderStatus: r.orderStatus, tableNowEmpty: r.tableNowEmpty,
  });
}

function billClosed(io, orderId, tableId) {
  orderClosed(io, orderId, tableId);
  tablesChanged(io);
}

const billRequested = (io, table) => io.emit('bill_requested', { tableId: table.id, tableLabel: table.label });

module.exports = {
  tablesChanged, orderSubmitted, orderDelivered, orderClosed, itemCancelled, roundCancelled, billClosed, billRequested,
};
