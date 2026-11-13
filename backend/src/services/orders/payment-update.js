'use strict';
/** Admin edit of a finished bill: payment info, customer info and (optionally) the visit's date. */
const tx = require('../../db/tenant/tx');
const { fail } = require('../../lib/http');
const { clip, isNum } = require('../../lib/input');
const { isGstin } = require('../../lib/gstin');
const { round2 } = require('../../lib/money');
const orders = require('../../repositories/orders/orders.repo');
const { METHODS } = require('./close-session');

const MAX_AMOUNT = 10000000;
const shift = (iso, delta) => (iso ? new Date(new Date(iso).getTime() + delta).toISOString() : null);

/** Moves every round of the visit by the same amount so their relative timing is preserved. */
function backdateVisit(order, createdAt) {
  const newDate = new Date(createdAt);
  const rows = order.session_id ? orders.sessionRows(order.table_id, order.session_id) : [order];
  const earliest = rows.reduce((min, o) => (new Date(o.created_at) < new Date(min.created_at) ? o : min), rows[0]);
  const delta = newDate.getTime() - new Date(earliest.created_at).getTime();
  for (const o of rows) orders.setDates(o.id, shift(o.created_at, delta), shift(o.delivered_at, delta), shift(o.closed_at, delta));
}

function amount(v, label) {
  if (v === undefined || v === null) return null;
  if (!isNum(v) || v < 0 || v > MAX_AMOUNT) fail(400, `${label} is not valid.`);
  return round2(v);
}

/** @returns { success, edited_at, audit } — `audit` (before/after) is for the audit log only. */
function updatePayment(orderId, body = {}) {
  if (!body.payment_method) fail(400, 'payment_method required');
  const method = clip(body.payment_method, 30).toLowerCase();
  if (!METHODS.includes(method)) fail(400, 'Unknown payment method.');
  const order = orders.byId(orderId);
  if (!order) fail(404, 'Order not found');

  const orderType = body.order_type === 'parcel' || body.order_type === 'dine_in' ? body.order_type : null;
  const editedAt = new Date().toISOString();
  const paid = amount(body.amount_paid, 'The amount paid');
  const change = amount(body.change_amount, 'The change') ?? 0;

  if (body.created_at) {
    const t = Date.parse(body.created_at);
    if (!Number.isFinite(t)) fail(400, 'The date is not valid.');
    if (t > Date.now() + 5 * 60000) fail(400, 'A visit cannot be dated in the future.');
  }

  return tx(() => {
    const target = order.session_id ? (orders.canonicalOfSession(order.table_id, order.session_id) || order) : order;
    const before = orders.byId(target.id);
    const gstin = clip(body.customer_gstin, 20).toUpperCase();
    if (gstin && gstin !== (before.customer_gstin || '') && !isGstin(gstin)) fail(400, 'That customer GSTIN is not valid.');

    orders.editPayment(target.id, {
      method,
      details: body.payment_details ? JSON.stringify(body.payment_details) : null,
      change,
      customerName: clip(body.customer_name, 80) || null,
      customerPhone: clip(body.customer_phone, 20) || null,
      customerGstin: gstin || null,
      amountPaid: paid, orderType, editedAt,
    });
    if (order.session_id) {
      orders.clearPaymentElsewhere(order.table_id, order.session_id, target.id);
      if (orderType) orders.setOrderTypeForSession(order.table_id, order.session_id, orderType);
    }
    if (body.created_at) backdateVisit(order, body.created_at);
    return {
      success: true, edited_at: editedAt,
      audit: {
        before: { method: before.payment_method, amount_paid: before.amount_paid, created_at: order.created_at, order_type: before.order_type },
        after: { method, amount_paid: paid, created_at: body.created_at || undefined, order_type: orderType || undefined },
      },
    };
  });
}

module.exports = { updatePayment };
