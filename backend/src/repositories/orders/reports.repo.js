'use strict';
/**
 * Read-only analytics queries. A visit belongs to the LOCAL day it was CLOSED (closed_at). Every filter is a plain
 * range on closed_at (see lib/local-time dayRangeUtc), so the (status, closed_at) index is used.
 */
const db = require('../../db/tenant');
const items = require('./order-items.repo');
const { localDaySql, dayRangeUtc, dayStartUtcIso, nextDay, addDaysStr, localToday } = require('../../lib/local-time');

const NOT_ARCHIVED_DINE_IN = "(is_parcel = 0 OR is_parcel IS NULL) AND (is_archived = 0 OR is_archived IS NULL)";

const todayTotals = (offset, day) => {
  const { lo, hi } = dayRangeUtc(day, day, offset);
  return db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total, COUNT(DISTINCT COALESCE(session_id, id)) AS session_count
    FROM orders WHERE status = 'closed' AND closed_at >= ? AND closed_at < ?`).get(lo, hi);
};

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

const topItems = (offset, day, limit = 5) => {
  const { lo, hi } = dayRangeUtc(day, day, offset);
  return db.prepare(`
    SELECT oi.name, SUM(oi.quantity) AS total_qty, SUM(oi.price * oi.quantity) AS total_rev
    FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at < ?
    GROUP BY oi.name ORDER BY total_qty DESC LIMIT ?`).all(lo, hi, limit);
};

/** Revenue per payment method, counted per VISIT (the method lives on one row of a multi-round visit). */
const paymentBreakdown = (offset, day) => {
  const { lo, hi } = dayRangeUtc(day, day, offset);
  return db.prepare(`
    SELECT payment_method, COUNT(*) AS count, SUM(total) AS total FROM (
      SELECT MAX(payment_method) AS payment_method, SUM(total) AS total
      FROM orders WHERE status = 'closed' AND closed_at >= ? AND closed_at < ?
      GROUP BY COALESCE(session_id, id)
    ) GROUP BY payment_method`).all(lo, hi);
};

function history({ from, to, limit, offset }) {
  const where = ["status = 'closed'"], vals = [];
  if (from) { where.push('closed_at >= ?'); vals.push(dayStartUtcIso(from, offset)); }
  if (to) { where.push('closed_at < ?'); vals.push(dayStartUtcIso(nextDay(to), offset)); }
  const rows = db.prepare(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY closed_at DESC LIMIT ?`).all(...vals, limit);
  return items.attachTo(rows);
}

/** The last 30 local days (today included). */
const revenueByDay = (offset) => {
  const lo = dayStartUtcIso(addDaysStr(localToday(offset), -29), offset);
  return db.prepare(`
    SELECT ${localDaySql('closed_at', offset)} AS day, SUM(total) AS revenue, COUNT(DISTINCT COALESCE(session_id, id)) AS orders
    FROM orders WHERE status = 'closed' AND closed_at >= ?
    GROUP BY day ORDER BY day ASC`).all(lo);
};

const tableDayOrders = (tableId, offset, day) => {
  const { lo, hi } = dayRangeUtc(day, day, offset);
  return db.prepare(`
    SELECT o.id, o.created_at, o.total, (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) AS items
    FROM orders o WHERE o.table_id = ? AND o.status IN ('delivered','closed') AND o.created_at >= ? AND o.created_at < ?
    ORDER BY o.created_at DESC`).all(tableId, lo, hi);
};

/** Closed orders of visits closed on a LOCAL day within [from, to], oldest first, with the table label. */
const closedBetween = (from, to, offset) => {
  const { lo, hi } = dayRangeUtc(from, to, offset);
  return db.prepare(`
    SELECT o.*, t.label AS table_label FROM orders o LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at < ?
    ORDER BY o.created_at ASC`).all(lo, hi);
};

module.exports = {
  todayTotals, activeCount, occupancy, topItems, paymentBreakdown, history, revenueByDay, tableDayOrders, closedBetween,
};
