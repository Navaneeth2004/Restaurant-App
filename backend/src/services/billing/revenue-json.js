'use strict';
const { round2 } = require('../../lib/money');

const splitDetails = (b) => (b.paymentMethod === 'split' && Array.isArray(b.paymentDetails) && b.paymentDetails.length
  ? b.paymentDetails.map(e => ({ method: e.method || 'unknown', amount: round2(Number(e.amount || 0)) }))
  : null);

function toJson(r) {
  const p = r.profile;
  return {
    generated_at: new Date().toISOString(), restaurant: p.restaurantName, period: r.period,
    summary: {
      total_revenue_pretax: r.summary.revenue, tax_collected: r.summary.tax, total_incl_tax: r.summary.totalInclTax,
      total_amount_paid: r.summary.amountPaid, tax_percent: parseFloat(p.taxPercentSetting || '5'),
      total_orders: r.summary.orders, total_items_sold: r.summary.itemsSold,
      avg_order_value: round2(r.summary.avgOrder), currency: p.currency,
    },
    order_type_breakdown: [
      { type: 'dine_in', label: 'Dine In', count: r.types.dine_in.count, revenue: round2(r.types.dine_in.revenue) },
      { type: 'parcel', label: 'Parcel', count: r.types.parcel.count, revenue: round2(r.types.parcel.revenue) },
    ],
    payment_breakdown: r.payments.map(x => ({ method: x.method, count: x.count, revenue: round2(x.revenue) })),
    daily_breakdown: r.daily,
    top_items: r.topItems.map(i => ({ ...i, revenue: round2(i.revenue) })),
    orders: r.bills.map(b => ({
      id: b.mainId, session_id: b.sessionId, table: b.tableLabel, order_type: b.orderType, created_at: b.createdAt, status: 'closed',
      customer_name: b.customerName, customer_phone: b.customerPhone, customer_gstin: b.gstin || null,
      payment_method: b.paymentMethod, split_details: splitDetails(b), change_amount: b.changeAmount,
      subtotal: b.taxable, tax: b.tax, total_incl_tax: b.total, amount_paid: round2(b.amountPaid),
      diff_from_bill: round2(b.amountPaid - b.total),
      items: b.items.map(i => ({ name: i.name, qty: i.quantity, price: i.price, note: i.note, subtotal: round2(i.price * i.quantity) })),
    })),
  };
}

module.exports = { toJson };
