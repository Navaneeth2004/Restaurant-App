'use strict';
/**
 * A BILL = one dining visit (all kitchen rounds sharing a session). Everything money-related (GST, revenue
 * export) is computed per bill, using the tax rate that was in force when the visit was closed.
 */
const { round2, splitGst } = require('../../lib/money');
const { localDayOf } = require('../../lib/local-time');

const parseJson = (s) => { try { return s ? JSON.parse(s) : null; } catch (_) { return null; } };

const invoiceLabel = (n) => `INV-${String(n).padStart(6, '0')}`;

function mergeItems(rows) {
  const merged = new Map();
  for (const o of rows) {
    for (const it of o.items || []) {
      const key = `${it.name}||${it.note || ''}||${it.price}`;
      const ex = merged.get(key);
      if (ex) ex.quantity += it.quantity;
      else merged.set(key, { name: it.name, price: it.price, quantity: it.quantity, note: it.note || '' });
    }
  }
  return [...merged.values()];
}

function buildBill(rows, currentRate, offset) {
  const first = rows[0];
  const newest = [...rows].reverse();
  const snap = rows.find(o => typeof o.tax_percent_snapshot === 'number');
  const rate = snap ? snap.tax_percent_snapshot : currentRate;
  const taxable = round2(rows.reduce((s, o) => s + (o.total || 0), 0));
  const { cgst, sgst, tax } = splitGst(taxable, rate);
  const total = round2(taxable + tax);
  const gstinRow = newest.find(o => o.customer_gstin && o.customer_gstin.trim());
  const payer = newest.find(o => o.payment_method);
  const paid = newest.find(o => o.amount_paid != null);
  const invoiceRow = rows.find(o => o.invoice_no);
  const pick = (f) => (newest.find(o => o[f]) || {})[f] || null;

  return {
    key: first.session_id ? `${first.table_id}|${first.session_id}` : `single|${first.id}`,
    rows, orderIds: rows.map(o => o.id), mainId: (invoiceRow || payer || newest[0]).id,
    sessionId: first.session_id || null, tableId: first.table_id, tableLabel: first.table_label || first.table_id,
    createdAt: first.created_at, localDay: localDayOf(first.created_at, offset),
    orderType: first.order_type === 'parcel' ? 'parcel' : 'dine_in',
    customerName: pick('customer_name'), customerPhone: pick('customer_phone'),
    gstin: gstinRow ? gstinRow.customer_gstin.trim().toUpperCase() : '',
    isB2B: !!gstinRow,
    rate, taxable, cgst, sgst, tax, total,
    paymentMethod: payer ? payer.payment_method : null,
    paymentDetails: payer ? parseJson(payer.payment_details) : null,
    changeAmount: payer && typeof payer.change_amount === 'number' ? payer.change_amount : 0,
    amountPaid: paid ? paid.amount_paid : total,
    invoiceNo: invoiceRow ? invoiceRow.invoice_no : null,
    // GST portal limit: invoice numbers are at most 16 characters
    invoiceLabel: invoiceRow ? invoiceLabel(invoiceRow.invoice_no) : `L${String(first.id).replace(/-/g, '').slice(0, 8)}`,
    items: mergeItems(rows),
  };
}

/** @param orders closed order rows (oldest first), optionally with `.items` */
function groupBills(orders, { currentRate, offset }) {
  const groups = new Map();
  for (const o of orders) {
    const key = o.session_id ? `${o.table_id}|${o.session_id}` : `single|${o.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  return [...groups.values()].map(rows => buildBill(rows, currentRate, offset));
}

/** Sums money fields over a list of bills. */
function sumBills(bills) {
  const s = { count: bills.length, taxable: 0, cgst: 0, sgst: 0, tax: 0, total: 0 };
  for (const b of bills) { s.taxable += b.taxable; s.cgst += b.cgst; s.sgst += b.sgst; s.tax += b.tax; s.total += b.total; }
  for (const k of ['taxable', 'cgst', 'sgst', 'tax', 'total']) s[k] = round2(s[k]);
  return s;
}

module.exports = { groupBills, sumBills, invoiceLabel };
