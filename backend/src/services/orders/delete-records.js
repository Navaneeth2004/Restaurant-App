'use strict';
/** Permanently removes CLOSED visits from history, keeping a summary in the audit log (admin PIN checked by the caller). */
const tx = require('../../db/tenant/tx');
const { fail } = require('../../lib/http');
const { round2, withTax } = require('../../lib/money');
const orders = require('../../repositories/orders/orders.repo');
const orderItems = require('../../repositories/orders/order-items.repo');
const deleted = require('../../repositories/orders/deleted-records.repo');
const settings = require('../../repositories/catalog/settings.repo');

const MAX_IDS = 500;

/** Groups the requested closed orders by visit (a visit = table + session). */
function groupVisits(orderIds) {
  const groups = new Map();
  for (const id of orderIds) {
    const o = orders.byId(String(id));
    if (!o || o.status !== 'closed') continue;
    const key = o.session_id ? `${o.table_id}|${o.session_id}` : `single|${o.id}`;
    if (!groups.has(key)) groups.set(key, o.session_id ? orders.closedInSession(o.table_id, o.session_id) : [o]);
  }
  return [...groups.values()].filter(g => g.length);
}

function mergeItems(visit) {
  const merged = new Map();
  for (const o of visit) {
    for (const it of orderItems.forOrder(o.id)) {
      const key = `${it.name}||${it.note || ''}||${it.price}`;
      const ex = merged.get(key);
      if (ex) ex.quantity += it.quantity;
      else merged.set(key, { name: it.name, price: it.price, quantity: it.quantity, note: it.note || '' });
    }
  }
  return [...merged.values()];
}

function logVisit(visit, adminName, now) {
  const first = visit[0];
  const subtotal = round2(visit.reduce((s, o) => s + (o.total || 0), 0));
  const snap = visit.find(o => typeof o.tax_percent_snapshot === 'number');
  const rate = snap ? snap.tax_percent_snapshot : settings.taxPercent();
  const newestFirst = [...visit].reverse();
  const paid = newestFirst.find(o => o.amount_paid != null);
  const payer = newestFirst.find(o => o.payment_method);
  const pick = (f) => (visit.find(o => o[f]) || {})[f] || null;
  const editedAt = visit.map(o => o.edited_at).filter(Boolean).sort().pop() || null;

  deleted.insert({
    deletedAt: now, deletedBy: adminName, tableId: first.table_id,
    tableLabel: deleted.tableLabel(first.table_id) || first.table_id,
    visitAt: first.created_at, orderCount: visit.length, subtotal, billTotal: withTax(subtotal, rate),
    amountPaid: paid ? paid.amount_paid : null, paymentMethod: payer ? payer.payment_method : null,
    orderType: pick('order_type'), customerName: pick('customer_name'), customerPhone: pick('customer_phone'),
    customerGstin: pick('customer_gstin'), wasEdited: editedAt ? 1 : 0, editedAt,
    itemsJson: JSON.stringify(mergeItems(visit)),
  });
}

/** @returns ids of the deleted order rows */
function deleteClosedVisits(orderIds, adminName) {
  if (!Array.isArray(orderIds) || !orderIds.length) fail(400, 'order_ids required');
  if (orderIds.length > MAX_IDS) fail(400, `At most ${MAX_IDS} orders can be deleted at once.`);

  return tx(() => {
    const now = new Date().toISOString();
    const removed = [];
    for (const visit of groupVisits(orderIds)) {
      logVisit(visit, adminName, now);
      for (const o of visit) { orderItems.removeForOrder(o.id); orders.deleteById(o.id); removed.push(o.id); }
    }
    return removed;
  });
}

const listDeleted = (limit = 500) => deleted.list(limit).map((r) => {
  let items = [];
  try { items = JSON.parse(r.items_json || '[]'); } catch (_) { /* keep [] */ }
  const out = { ...r, items };
  delete out.items_json;
  return out;
});

module.exports = { deleteClosedVisits, listDeleted };
