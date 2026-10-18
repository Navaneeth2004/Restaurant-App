'use strict';
/** Parcel (takeaway) slots are special tables with ids P1, P2 ... */
const { fail } = require('../../lib/http');
const { clip } = require('../../lib/input');
const { isParcelId, newKioskToken } = require('../../lib/ids');
const tables = require('../../repositories/catalog/tables.repo');
const orders = require('../../repositories/orders/orders.repo');

function nextParcelId() {
  const used = new Set(tables.parcelIds());   // includes archived slots so ids never collide
  for (let n = 1; n <= 999; n++) if (!used.has(`P${n}`)) return `P${n}`;
  return `P${Date.now()}`;
}

function createSlot(rid, { customer_name, customer_phone } = {}) {
  const id = nextParcelId();
  const name = clip(customer_name, 60);
  tables.insertParcel({
    id, label: name || `Parcel ${id.slice(1)}`, sortOrder: tables.maxSort() + 1,
    customerName: name || null, customerPhone: clip(customer_phone, 20) || null, token: newKioskToken(rid),
  });
  return tables.byId(id);
}

const listSlots = () => tables.listParcels();

/** Soft-delete so linked orders (reports, history) stay intact. */
function removeSlot(id) {
  if (!isParcelId(id)) fail(400, 'Not a parcel slot');
  if (orders.countOpenAtTable(id) > 0) fail(400, 'Cannot remove — this parcel has open orders. Close the bill first.');
  tables.archive(id);
  return { success: true };
}

module.exports = { createSlot, listSlots, removeSlot };
