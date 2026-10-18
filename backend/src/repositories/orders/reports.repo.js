'use strict';
/** Read-only analytics queries. `offset` = client's minutes ahead of UTC (see lib/local-time.js). */
const db = require('../../db/tenant');
const items = require('./order-items.repo');
const { localDaySql } = require('../../lib/local-time');

const NOT_ARCHIVED_DINE_IN = "(is_parcel = 0 OR is_parcel IS NULL) AND (is_archived = 0 OR is_archived IS NULL)";

const todayTotals = (offset, day) => db.prepare(`
  SELECT COALESCE(SUM(total), 0) AS total, COUNT(DISTINCT COALESCE(session_id, id)) AS session_count
  FROM orders WHERE status = 'closed' AND ${localDaySql('created_at', offset)} = ?`).get(day);

const activeCount = () => db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'active'").get().c;

function occupancy() {
  const busy = "status IN ('occupied','waiting_bill')";
  return {
    occupiedTables: db.prepare(`SELECT COUNT(*) AS c FROM tables WHERE ${busy} AND ${NOT_ARCHIVED_DINE_IN}`).get().c,
    seatsTotal: db.prepare(`SELECT SUM(seats) AS s FROM tables WHERE ${NOT_ARCHIVED_DINE_IN}`).get().s || 0,
    seatsFilled: db.prepare(`SELECT SUM(seats) AS s FROM tables WHERE ${busy} AND ${NOT_ARCHIVED_DINE_IN}`).get().s || 0,
    parcelsActive: db.prepare(`SELECT COUNT(*) AS c FROM tables WHERE is_parcel = 1 AND (is_archived = 0 OR is_archived IS NULL) AND ${busy}`).get().c,
  };
}

const topItems = (offset, day, limit = 5) => db.prepare(`
  SELECT oi.name, SUM(oi.quantity) AS total_qty, SUM(oi.price * oi.quantity) AS total_rev
  FROM order_items oi JOIN orders o ON oi.order_id = o.id
  WHERE o.status = 'closed' AND ${localDaySql('o.created_at', offset)} = ?
  GROUP BY oi.name ORDER BY total_qty DESC LIMIT ?`).all(day, limit);

/** Revenue per payment method, counted per VISIT (the method lives on one row of a multi-round visit). */
const paymentBreakdown = (offset, day) => db.prepare(`
  SELECT payment_method, COUNT(*) AS count, SUM(total) AS total FROM (
    SELECT MAX(payment_method) AS payment_method, SUM(total) AS total
    FROM orders WHERE status = 'closed' AND ${localDaySql('created_at', offset)} = ?
    GROUP BY COALESCE(session_id, id)
  ) GROUP BY payment_method`).all(day);

function history({ from, to, limit, offset }) {
  const day = localDaySql('created_at', offset);
  const where = ["status = 'closed'"], vals = [];
  if (from) { where.push(`${day} >= ?`); vals.push(from); }
  if (to) { where.push(`${day} <= ?`); vals.push(to); }
  const rows = db.prepare(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...vals, limit);
  return items.attachTo(rows);
}

const revenueByDay = (offset) => db.prepare(`
  SELECT ${localDaySql('created_at', offset)} AS day, SUM(total) AS revenue, COUNT(DISTINCT COALESCE(session_id, id)) AS orders
  FROM orders WHERE status = 'closed' AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 days')
  GROUP BY day ORDER BY day ASC`).all();

const tableDayOrders = (tableId, offset, day) => db.prepare(`
  SELECT o.id, o.created_at, o.total, (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) AS items
  FROM orders o WHERE o.table_id = ? AND o.status IN ('delivered','closed') AND ${localDaySql('o.created_at', offset)} = ?
  ORDER BY o.created_at DESC`).all(tableId, day);

/** Closed orders whose LOCAL day is within [from, to], oldest first, with the table label. */
const closedBetween = (from, to, offset) => db.prepare(`
  SELECT o.*, t.label AS table_label FROM orders o LEFT JOIN tables t ON o.table_id = t.id
  WHERE o.status = 'closed' AND ${localDaySql('o.created_at', offset)} >= ? AND ${localDaySql('o.created_at', offset)} <= ?
  ORDER BY o.created_at ASC`).all(from, to);

module.exports = {
  todayTotals, activeCount, occupancy, topItems, paymentBreakdown, history, revenueByDay, tableDayOrders, closedBetween,
};
