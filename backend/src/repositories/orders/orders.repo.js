'use strict';
const db = require('../../db/tenant');
const items = require('./order-items.repo');

const OPEN = "status IN ('active','delivered')";

// ── reads ──
const byId = (id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
function withItems(id) {
  const order = byId(id);
  if (order) order.items = items.forOrder(id);
  return order || null;
}
const listActive = () => items.attachTo(db.prepare("SELECT * FROM orders WHERE status = 'active' ORDER BY created_at ASC").all());
const activeForTable = (tableId) => db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(tableId);
const lastDeliveredForTable = (tableId) =>
  db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'delivered' ORDER BY delivered_at DESC LIMIT 1").get(tableId);
const activeIdsForTable = (tableId) => db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'active'").all(tableId);
const history = (limit) => items.attachTo(db.prepare("SELECT * FROM orders WHERE status = 'closed' ORDER BY created_at DESC LIMIT ?").all(limit));

// ── sessions (one dining visit = several order rows sharing a session_id) ──
const latestSessionId = (tableId) => (db.prepare(
  `SELECT session_id FROM orders WHERE table_id = ? AND ${OPEN} ORDER BY created_at DESC LIMIT 1`).get(tableId) || {}).session_id || null;
const sessionOrders = (tableId, sessionId) => items.attachTo(db.prepare(
  'SELECT * FROM orders WHERE table_id = ? AND session_id IS ? ORDER BY created_at ASC').all(tableId, sessionId));
const sessionRows = (tableId, sessionId) =>
  db.prepare('SELECT id, created_at, delivered_at FROM orders WHERE table_id = ? AND session_id IS ?').all(tableId, sessionId);
const openInSession = (tableId, sessionId) =>
  db.prepare(`SELECT id, total FROM orders WHERE table_id = ? AND session_id IS ? AND ${OPEN}`).all(tableId, sessionId);
const closedInSession = (tableId, sessionId) =>
  db.prepare("SELECT * FROM orders WHERE table_id = ? AND session_id IS ? AND status = 'closed' ORDER BY created_at ASC").all(tableId, sessionId);
const countOpenAtTable = (tableId) => db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE table_id = ? AND ${OPEN}`).get(tableId).c;
const sessionHasInvoice = (tableId, sessionId) =>
  !!db.prepare('SELECT 1 FROM orders WHERE table_id = ? AND session_id IS ? AND invoice_no IS NOT NULL').get(tableId, sessionId);
const canonicalOfSession = (tableId, sessionId) =>
  db.prepare('SELECT id FROM orders WHERE table_id = ? AND session_id IS ? ORDER BY created_at DESC LIMIT 1').get(tableId, sessionId);

// ── writes ──
const insert = (o) => db.prepare(
  'INSERT INTO orders (id, table_id, session_id, status, created_at, delivered_at, order_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(o.id, o.table_id, o.session_id, o.status || 'active', o.created_at, o.delivered_at || null, o.order_type || 'dine_in');
const recalcTotal = (id) => db.prepare(
  'UPDATE orders SET total = ROUND((SELECT COALESCE(SUM(price * quantity), 0) FROM order_items WHERE order_id = ?), 2) WHERE id = ?').run(id, id);
const markDelivered = (id, at) => db.prepare("UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ?").run(at, id);
const deleteById = (id) => db.prepare('DELETE FROM orders WHERE id = ?').run(id);
const deleteAll = () => db.prepare('DELETE FROM orders').run();

const closeSession = (tableId, sessionId, f) => db.prepare(`
  UPDATE orders SET status = 'closed', customer_name = ?, customer_phone = ?, customer_gstin = ?, order_type = ?, tax_percent_snapshot = ?
  WHERE table_id = ? AND session_id IS ? AND ${OPEN}`)
  .run(f.customerName, f.customerPhone, f.customerGstin, f.orderType, f.taxPercent, tableId, sessionId);

const setPaymentOnClose = (id, f) => db.prepare(
  'UPDATE orders SET payment_method = ?, payment_details = ?, change_amount = ?, amount_paid = ? WHERE id = ?')
  .run(f.method, f.details, f.change, f.amountPaid, id);

const nextInvoiceNo = () => db.prepare('SELECT COALESCE(MAX(invoice_no), 0) + 1 AS n FROM orders').get().n;
const setInvoiceNo = (id, n) => db.prepare('UPDATE orders SET invoice_no = ? WHERE id = ?').run(n, id);

/** Edit of payment/customer info on the session's main row (admin, after closing). */
const editPayment = (id, f) => db.prepare(`
  UPDATE orders SET payment_method = ?, payment_details = ?, change_amount = ?,
    customer_name = COALESCE(?, customer_name), customer_phone = COALESCE(?, customer_phone),
    customer_gstin = COALESCE(?, customer_gstin), amount_paid = ?, order_type = COALESCE(?, order_type), edited_at = ?
  WHERE id = ?`)
  .run(f.method, f.details, f.change, f.customerName, f.customerPhone, f.customerGstin, f.amountPaid, f.orderType, f.editedAt, id);

/** After an edit, the other rows of the session must not carry payment data (it lives on one row only). */
const clearPaymentElsewhere = (tableId, sessionId, keepId) => db.prepare(`
  UPDATE orders SET payment_method = NULL, payment_details = NULL, change_amount = 0, amount_paid = NULL
  WHERE table_id = ? AND session_id IS ? AND id != ?`).run(tableId, sessionId, keepId);

const setDates = (id, createdAt, deliveredAt) =>
  db.prepare('UPDATE orders SET created_at = ?, delivered_at = ? WHERE id = ?').run(createdAt, deliveredAt, id);

module.exports = {
  byId, withItems, listActive, activeForTable, lastDeliveredForTable, activeIdsForTable, history,
  latestSessionId, sessionOrders, sessionRows, openInSession, closedInSession, countOpenAtTable,
  sessionHasInvoice, canonicalOfSession, insert, recalcTotal, markDelivered, deleteById, deleteAll,
  closeSession, setPaymentOnClose, nextInvoiceNo, setInvoiceNo, editPayment, clearPaymentElsewhere, setDates,
};
