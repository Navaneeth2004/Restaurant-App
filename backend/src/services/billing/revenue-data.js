'use strict';
/** Revenue report data: per-visit (bill) accounting with each visit's own tax rate and the restaurant's local dates. */
const { round2 } = require('../../lib/money');
const { loadRange } = require('./gst-data');

const bump = (map, key, init) => map[key] || (map[key] = init);

function build({ from, to, offset }) {
  const d = loadRange({ from, to, offset, defaultFrom: '2020-01-01', withItems: true });
  const daily = {}, itemMap = {}, payMap = {};
  const types = { dine_in: { count: 0, revenue: 0 }, parcel: { count: 0, revenue: 0 } };
  let totalItems = 0;

  for (const b of d.bills) {
    const qty = b.items.reduce((s, i) => s + i.quantity, 0);
    totalItems += qty;
    const day = bump(daily, b.localDay, { date: b.localDay, revenue: 0, orders: 0, items_sold: 0, tax: 0, total_incl_tax: 0 });
    day.revenue += b.taxable; day.orders += 1; day.items_sold += qty; day.tax += b.tax; day.total_incl_tax += b.total;

    for (const i of b.items) {
      const it = bump(itemMap, i.name, { name: i.name, qty_sold: 0, revenue: 0 });
      it.qty_sold += i.quantity; it.revenue += i.price * i.quantity;
    }
    const method = b.paymentMethod || 'unknown';
    const pay = bump(payMap, method, { method, count: 0, revenue: 0 });
    pay.count += 1; pay.revenue += b.taxable;
    types[b.orderType].count += 1; types[b.orderType].revenue += b.taxable;
  }

  const sum = (f) => round2(d.bills.reduce((s, b) => s + f(b), 0));
  const revenue = sum(b => b.taxable);
  const summary = {
    revenue, tax: sum(b => b.tax), totalInclTax: sum(b => b.total), amountPaid: sum(b => b.amountPaid),
    orders: d.bills.length, itemsSold: totalItems, avgOrder: d.bills.length ? revenue / d.bills.length : 0,
  };

  return {
    period: { from: d.dateFrom, to: d.dateTo }, offset, profile: d.profile, bills: d.bills, summary, types,
    daily: Object.values(daily).map(r => ({ ...r, revenue: round2(r.revenue), tax: round2(r.tax), total_incl_tax: round2(r.total_incl_tax) })),
    topItems: Object.values(itemMap).sort((a, b) => b.revenue - a.revenue),
    payments: Object.values(payMap).sort((a, b) => b.revenue - a.revenue),
  };
}

module.exports = { build };
