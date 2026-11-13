'use strict';
/**
 * Closes a whole dining visit (every open round at the table) in one go.
 * Payment info is stored on ONE row (the one the bill was closed from); the visit also gets a short
 * invoice number the first time it is closed. If the client says which rounds the bill was built from (order_ids)
 * and a round was added meanwhile, the close is refused so nothing is charged that was not on the bill.
 */
const tx = require('../../db/tenant/tx');
const { fail } = require('../../lib/http');
const { clip, isNum } = require('../../lib/input');
const { isGstin } = require('../../lib/gstin');
const { round2, withTax } = require('../../lib/money');
const orders = require('../../repositories/orders/orders.repo');
const tables = require('../../repositories/catalog/tables.repo');
const settings = require('../../repositories/catalog/settings.repo');

const METHODS = ['cash', 'upi', 'card', 'cheque', 'split'];
const MAX_AMOUNT = 10000000;

function amountField(v, label) {
  if (v === undefined || v === null) return undefined;
  if (!isNum(v) || v < 0 || v > MAX_AMOUNT) fail(400, `${label} is not valid.`);
  return round2(v);
}

function paymentFields(body) {
  const details = body.payment_details ? JSON.stringify(body.payment_details) : null;
  if (details && details.length > 5000) fail(400, 'payment_details is too large.');
  const method = clip(body.payment_method, 30).toLowerCase() || 'cash';
  if (!METHODS.includes(method)) fail(400, 'Unknown payment method.');
  const gstin = clip(body.customer_gstin, 20).toUpperCase();
  if (gstin && !isGstin(gstin)) fail(400, 'That customer GSTIN is not valid.');
  return {
    method, details,
    change: amountField(body.change_amount, 'The change') ?? 0,
    paid: amountField(body.amount_paid, 'The amount paid'),
    customerName: clip(body.customer_name, 80) || null,
    customerPhone: clip(body.customer_phone, 20) || null,
    customerGstin: gstin || null,
    orderType: body.order_type === 'parcel' ? 'parcel' : 'dine_in',
  };
}

/** @returns { tableId, alreadyClosed, closedIds } */
function closeSession(orderId, body = {}) {
  if (!orders.byId(orderId)) fail(404, 'Order not found');
  const pay = paymentFields(body);

  return tx(() => {
    const order = orders.byId(orderId);
    const open = orders.openInSession(order.table_id, order.session_id);
    if (!open.length) return { tableId: order.table_id, alreadyClosed: true, closedIds: [] };

    if (Array.isArray(body.order_ids)) {
      const billed = new Set(body.order_ids.map(String));
      if (open.some(o => !billed.has(o.id))) {
        fail(409, "This table's order changed while you were billing. Close this screen and open the bill again.", { code: 'order_changed' });
      }
    }

    const taxPercent = settings.taxPercent();
    const subtotal = round2(open.reduce((sum, o) => sum + (o.total || 0), 0));
    const billTotal = withTax(subtotal, taxPercent);
    const amountPaid = pay.paid !== undefined ? pay.paid : billTotal;

    orders.closeSession(order.table_id, order.session_id, {
      customerName: pay.customerName, customerPhone: pay.customerPhone, customerGstin: pay.customerGstin,
      orderType: pay.orderType, taxPercent, closedAt: new Date().toISOString(),
    });
    orders.setPaymentOnClose(orderId, { method: pay.method, details: pay.details, change: pay.change, amountPaid });
    if (!orders.sessionHasInvoice(order.table_id, order.session_id)) orders.setInvoiceNo(orderId, orders.nextInvoiceNo());
    tables.setStatus(order.table_id, 'empty');
    return { tableId: order.table_id, alreadyClosed: false, closedIds: open.map(o => o.id) };
  });
}

module.exports = { closeSession, METHODS };
