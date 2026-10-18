'use strict';
/** A "session" is one dining visit: every order round at a table shares a session_id. */
const { v4: uuidv4 } = require('uuid');
const { fail } = require('../../lib/http');
const orders = require('../../repositories/orders/orders.repo');
const tables = require('../../repositories/catalog/tables.repo');

/** The table, or a 404 when it does not exist / was removed. */
function requireTable(tableId) {
  const table = tableId ? tables.byId(String(tableId)) : null;
  if (!table || table.is_archived) fail(404, 'Table not found');
  return table;
}

/** Occupied table -> join the running visit; empty table -> a brand-new visit. */
function sessionIdForNewOrder(table) {
  if (table.status !== 'empty') return orders.latestSessionId(table.id) || uuidv4();
  return uuidv4();
}

const currentSessionId = (tableId) => orders.latestSessionId(tableId);

module.exports = { requireTable, sessionIdForNewOrder, currentSessionId };
