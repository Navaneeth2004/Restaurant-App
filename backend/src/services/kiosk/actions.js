'use strict';
/** What a customer's phone may do: place an order, ask for the bill. */
const { fail } = require('../../lib/http');
const { submitOrder } = require('../orders/submit-order');
const { markTableDelivered } = require('../orders/deliver');
const { currentSessionId } = require('../orders/session');

/** A phone that scanned the QR for an earlier visit must rescan. */
function assertSameVisit(tableId, clientSessionId) {
  const current = currentSessionId(tableId);
  if (current && clientSessionId && clientSessionId !== current) {
    fail(409, "This table's session has changed. Please rescan the QR code to continue.", { session_changed: true });
  }
}

function placeOrder(table, { items, client_session_id } = {}) {
  if (!Array.isArray(items) || !items.length) fail(400, 'items required');
  assertSameVisit(table.id, client_session_id);
  return submitOrder({ tableId: table.id, items, source: 'kiosk' });
}

/** @returns orders that were just marked delivered */
function requestBill(table, { client_session_id } = {}) {
  if (table.status === 'empty') fail(400, 'No active order on this table.');
  assertSameVisit(table.id, client_session_id);
  return markTableDelivered(table.id);
}

module.exports = { placeOrder, requestBill };
