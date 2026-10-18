'use strict';
/**
 * Closes a whole dining visit (every open round at the table) in one go.
 * Payment info is stored on ONE row (the one the bill was closed from); the visit also gets a short
 * invoice number the first time it is closed.
 */
const tx = require('../../db/tenant/tx');
const { fail } = require('../../lib/http');
const { clip, isNum } = require('../../lib/input');
const { round2, withTax } = require('../../lib/money');
const orders = require('../../repositories/orders/orders.repo');
const tables = require('../../repositories/catalog/tables.repo');
const settings = require('../../repositories/catalog/settings.repo');

function paymentFields(body) {
  const details = body.payment_details ? JSON.stringify(body.payment_details) : null;
  if (details && details.length > 5000) fail(400, 'payment_details is too large.');
  return {
    method: clip(body.payment_method, 30) || 'cash',
    details,
    change: isNum(body.change_amount) ? body.change_amount : 0,
    customerName: clip(body.customer_name, 80) || null,
    customerPhone: clip(body.customer_phone, 20) || null,
    customerGstin: clip(body.customer_gstin, 20).toUpperCase() || null,
    orderType: body.order_type === 'parcel' ? 'parcel' : 'dine_in',
  };
}

/** @returns { tableId, alreadyClosed } */
function closeSession(orderId, body = {}) {
  if (!orders.byId(orderId)) fail(404, 'Order not found');
  const pay = paymentFields(body);

  return tx(() => {
    const order = orders.byId(orderId);
    const open = orders.openInSession(order.table_id, order.session_id);
    if (!open.length) return { tableId: order.table_id, alreadyClosed: true };

    const taxPercent = settings.taxPercent();
    const subtotal = open.reduce((sum, o) => sum + (o.total || 0), 0);
    const billTotal = withTax(subtotal, taxPercent);
    const amountPaid = isNum(body.amount_paid) ? round2(body.amount_paid) : billTotal;

    orders.closeSession(order.table_id, order.session_id, {
      customerName: pay.customerName, customerPhone: pay.customerPhone, customerGstin: pay.customerGstin,
      orderType: pay.orderType, taxPercent,
    });
    orders.setPaymentOnClose(orderId, { method: pay.method, details: pay.details, change: pay.change, amountPaid });
    if (!orders.sessionHasInvoice(order.table_id, order.session_id)) orders.setInvoiceNo(orderId, orders.nextInvoiceNo());
    tables.setStatus(order.table_id, 'empty');
    return { tableId: order.table_id, alreadyClosed: false };
  });
}

module.exports = { closeSession };
