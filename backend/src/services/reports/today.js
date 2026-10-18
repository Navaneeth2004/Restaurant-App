'use strict';
/** The dashboard numbers for the restaurant's current local day. */
const reports = require('../../repositories/orders/reports.repo');
const { localToday } = require('../../lib/local-time');

function today(offset) {
  const day = localToday(offset);
  const totals = reports.todayTotals(offset, day);
  const occ = reports.occupancy();
  return {
    revenue: totals.total,
    ordersCount: totals.session_count,          // visits, not kitchen rounds
    activeOrders: reports.activeCount(),
    occupiedTables: occ.occupiedTables,
    dineInSeatsTotal: occ.seatsTotal,
    dineInSeatsFilled: occ.seatsFilled,
    parcelsActive: occ.parcelsActive,
    topItems: reports.topItems(offset, day),
    paymentBreakdown: reports.paymentBreakdown(offset, day),
  };
}

module.exports = { today };
