'use strict';
const ctx = require('../../db/context');
const { fail } = require('../../lib/http');
const { clip, toInt } = require('../../lib/input');
const tables = require('../../repositories/catalog/tables.repo');
const orders = require('../../repositories/orders/orders.repo');
const reports = require('../../repositories/orders/reports.repo');
const limits = require('../restaurants/limits');
const { localToday } = require('../../lib/local-time');

const STATUSES = ['empty', 'occupied', 'waiting_bill'];

const list = () => tables.listVisible();

/** Today's performance of one table. */
function stats(tableId, offset) {
  const rows = reports.tableDayOrders(tableId, offset, localToday(offset));
  const revenue = rows.reduce((s, r) => s + (r.total || 0), 0);
  return {
    orders_today: rows.length,
    revenue_today: revenue,
    items_today: rows.reduce((s, r) => s + (r.items || 0), 0),
    avg_order_value: rows.length ? revenue / rows.length : 0,
    last_order_at: rows[0] ? rows[0].created_at : null,
  };
}

/** Next free id T<n>, also avoiding ids of archived tables. */
function nextTableId() {
  const used = new Set(tables.allIds());
  let n = used.size + 1;
  while (used.has(`T${n}`)) n++;
  return `T${n}`;
}

function create({ label, seats }) {
  const clean = clip(label, 40);
  if (!clean) fail(400, 'Label required');
  const lim = limits.check(ctx.get().restaurant, 'max_tables', tables.countVisible());
  if (!lim.ok) fail(403, `Your plan allows up to ${lim.limit} tables.`, { code: 'plan_limit' });
  const id = nextTableId();
  tables.insert({ id, label: clean, seats: toInt(seats, 4) || 4, sortOrder: tables.maxSort() + 1 });
  return tables.byId(id);
}

function update(id, { label, seats, status }) {
  if (!tables.byId(id)) fail(404, 'Table not found');
  if (status && !STATUSES.includes(status)) fail(400, 'Invalid status');
  tables.update(id, { label: label ? clip(label, 40) : null, seats: seats ? toInt(seats) : null, status: status || null });
  return tables.byId(id);
}

function reorder(order) {
  if (!Array.isArray(order)) fail(400, 'order array required');
  tables.reorder(order);
  return { success: true };
}

/** Tables with order history are archived (so reports keep working); unused ones are really deleted. */
function remove(id) {
  const table = tables.byId(id);
  if (!table) fail(404, 'Table not found');
  if (table.status !== 'empty') fail(400, 'Cannot delete an occupied table. Clear the order and mark as paid first.');
  if (orders.countOpenAtTable(id) > 0) fail(400, 'Table has an active order. Close it first.');
  if (tables.hasOrderHistory(id)) tables.archive(id);
  else tables.hardDelete(id);
  return { success: true };
}

module.exports = { list, stats, create, update, reorder, remove };
