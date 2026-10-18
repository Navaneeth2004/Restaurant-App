'use strict';
/**
 * "Send to kitchen". `items` is a pure ADDITIVE contribution: matching (menu item, note) rows get their
 * quantity increased, the rest are inserted. Existing rows are never deleted here, so two devices adding
 * to the same table at once can never overwrite each other.
 */
const { v4: uuidv4 } = require('uuid');
const tx = require('../../db/tenant/tx');
const orders = require('../../repositories/orders/orders.repo');
const orderItems = require('../../repositories/orders/order-items.repo');
const tables = require('../../repositories/catalog/tables.repo');
const { isParcelId } = require('../../lib/ids');
const { normalizeItems } = require('./order-input');
const { requireTable, sessionIdForNewOrder } = require('./session');

/** @param source 'staff' (client prices trusted) | 'kiosk' (prices read from the menu) */
function submitOrder({ tableId, items, source = 'staff' }) {
  const table = requireTable(tableId);
  const lines = normalizeItems(items, { authoritative: source === 'kiosk' });

  return tx(() => {
    const active = orders.activeForTable(table.id);
    if (active) {
      for (const line of lines) {
        const row = orderItems.find(active.id, line.menu_item_id, line.note);
        if (row) orderItems.addQuantity(row.id, line.quantity);
        else orderItems.insert(active.id, line);
      }
      orders.recalcTotal(active.id);
      return { order: orders.withItems(active.id), isNew: false, additions: lines };
    }

    const id = uuidv4();
    orders.insert({
      id, table_id: table.id, session_id: sessionIdForNewOrder(table), status: 'active',
      created_at: new Date().toISOString(), order_type: isParcelId(table.id) ? 'parcel' : 'dine_in',
    });
    tables.setStatus(table.id, 'occupied');
    for (const line of lines) orderItems.insert(id, line);
    orders.recalcTotal(id);
    return { order: orders.withItems(id), isNew: true, additions: lines };
  });
}

module.exports = { submitOrder };
