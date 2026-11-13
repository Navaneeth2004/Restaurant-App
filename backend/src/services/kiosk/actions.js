'use strict';
/** What a customer's phone may do: place an order, ask for the bill. */
const { fail } = require('../../lib/http');
const { submitOrder } = require('../orders/submit-order');
const { currentSessionId } = require('../orders/session');
const tables = require('../../repositories/catalog/tables.repo');

/**
 * A phone must name the visit it is part of. If the table has a running visit and the phone does not send that
 * visit's id (or sends an older one) it must rescan: a stale or forged request can no longer join or alter it.
 */
function assertSameVisit(tableId, clientSessionId) {
  const current = currentSessionId(tableId);
  if (current && clientSessionId !== current) {
    fail(409, "This table's session has changed. Please rescan the QR code to continue.", { session_changed: true });
  }
}

function placeOrder(table, { items, client_session_id } = {}) {
  if (!Array.isArray(items) || !items.length) fail(400, 'items required');
  assertSameVisit(table.id, client_session_id);
  return submitOrder({ tableId: table.id, items, source: 'kiosk' });
}

/**
 * The guest asks for the bill: the table is flagged "waiting for bill" for the waiter. Rounds still in the kitchen
 * are NOT marked delivered (that would silently drop them from the kitchen screen); the waiter does that when billing.
 * @returns [] (kept for the route, which used to receive the delivered orders)
 */
function requestBill(table, { client_session_id } = {}) {
  if (table.status === 'empty') fail(400, 'No active order on this table.');
  assertSameVisit(table.id, client_session_id);
  tables.setStatus(table.id, 'waiting_bill');
  return [];
}

module.exports = { placeOrder, requestBill };
