'use strict';
/** Admin edit of a finished bill: payment info, customer info and (optionally) the visit's date. */
const tx = require('../../db/tenant/tx');
const { fail } = require('../../lib/http');
const { clip, isNum } = require('../../lib/input');
const orders = require('../../repositories/orders/orders.repo');

/** Moves every round of the visit by the same amount so their relative timing is preserved. */
function backdateVisit(order, createdAt) {
  const newDate = new Date(createdAt);
  if (Number.isNaN(newDate.getTime())) return;
  const rows = order.session_id ? orders.sessionRows(order.table_id, order.session_id) : [order];
  const earliest = rows.reduce((min, o) => (new Date(o.created_at) < new Date(min.created_at) ? o : min), rows[0]);
  const delta = newDate.getTime() - new Date(earliest.created_at).getTime();
  for (const o of rows) {
    const created = new Date(new Date(o.created_at).getTime() + delta).toISOString();
    const delivered = o.delivered_at ? new Date(new Date(o.delivered_at).getTime() + delta).toISOString() : null;
    orders.setDates(o.id, created, delivered);
  }
}

function updatePayment(orderId, body = {}) {
  if (!body.payment_method) fail(400, 'payment_method required');
  const order = orders.byId(orderId);
  if (!order) fail(404, 'Order not found');

  const orderType = body.order_type === 'parcel' || body.order_type === 'dine_in' ? body.order_type : null;
  const editedAt = new Date().toISOString();

  tx(() => {
    const target = order.session_id ? (orders.canonicalOfSession(order.table_id, order.session_id) || order) : order;
    orders.editPayment(target.id, {
      method: clip(body.payment_method, 30),
      details: body.payment_details ? JSON.stringify(body.payment_details) : null,
      change: isNum(body.change_amount) ? body.change_amount : 0,
      customerName: clip(body.customer_name, 80) || null,
      customerPhone: clip(body.customer_phone, 20) || null,
      customerGstin: clip(body.customer_gstin, 20).toUpperCase() || null,
      amountPaid: isNum(body.amount_paid) ? body.amount_paid : null,
      orderType, editedAt,
    });
    if (order.session_id) orders.clearPaymentElsewhere(order.table_id, order.session_id, target.id);
    if (body.created_at) backdateVisit(order, body.created_at);
  });
  return { success: true, edited_at: editedAt };
}

module.exports = { updatePayment };
