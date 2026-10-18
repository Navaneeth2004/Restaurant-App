'use strict';
/** Revenue report as a CSV (Excel-friendly, UTF-8 with BOM). */
const { round2 } = require('../../lib/money');
const { localDMY, localTimeOf } = require('../../lib/local-time');

const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const row = (...cols) => cols.map(quote).join(',');
const diffText = (n) => (n === 0 ? '0.00' : n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

function summaryLines(r, c) {
  const s = r.summary, p = r.profile, rate = p.taxPercentSetting || 5;
  return [
    row(p.restaurantName || 'Restaurant', 'Revenue Report'),
    row('Generated', new Date().toLocaleString()),
    row('Period', `${r.period.from}  to  ${r.period.to}`),
    row('Tax Rate (current setting)', `${rate}%`), '',
    row('── SUMMARY ──'), row('Metric', 'Value'),
    row('Total Revenue (pre-tax)', `${c}${s.revenue.toFixed(2)}`),
    row('Tax Collected', `${c}${s.tax.toFixed(2)}`),
    row('Total incl. Tax', `${c}${s.totalInclTax.toFixed(2)}`),
    row('Total Amount Actually Paid', `${c}${s.amountPaid.toFixed(2)}`),
    row('Total Orders (visits)', s.orders), row('Total Items Sold', s.itemsSold),
    row('Average Order Value (pre-tax)', s.orders ? `${c}${s.avgOrder.toFixed(2)}` : '—'), '',
    row('── ORDER TYPE BREAKDOWN ──'), row('Type', 'Orders', `Revenue ${c}`),
    row('Dine In', r.types.dine_in.count, r.types.dine_in.revenue.toFixed(2)),
    row('Parcel', r.types.parcel.count, r.types.parcel.revenue.toFixed(2)), '',
  ];
}

function tableLines(r, c) {
  const total = r.summary.revenue;
  const pct = (v) => (total > 0 ? ((v / total) * 100).toFixed(1) : '0.0');
  const lines = [];
  if (r.payments.length) {
    lines.push(row('── PAYMENT METHODS ──'), row('Method', 'Orders', `Revenue ${c}`, '% of Total'));
    r.payments.forEach(p => lines.push(row(p.method.toUpperCase(), p.count, p.revenue.toFixed(2), `${pct(p.revenue)}%`)));
    lines.push('');
  }
  lines.push(row('── DAILY BREAKDOWN ──'),
    row('Date', 'Orders', 'Items Sold', `Revenue (pre-tax) ${c}`, `Tax ${c}`, `Total incl. Tax ${c}`));
  r.daily.forEach(d => lines.push(row(d.date, d.orders, d.items_sold, d.revenue.toFixed(2), d.tax.toFixed(2), d.total_incl_tax.toFixed(2))));
  lines.push('', row('── TOP ITEMS ──'), row('Rank', 'Item Name', 'Qty Sold', `Revenue ${c}`, '% of Total Revenue'));
  r.topItems.forEach((i, n) => lines.push(row(n + 1, i.name, i.qty_sold, i.revenue.toFixed(2), `${pct(i.revenue)}%`)));
  return lines.concat('');
}

function orderLines(r, c) {
  const lines = [row('── ORDER DETAIL ──'), row(
    'Order ID', 'Session ID', 'Table', 'Order Type', 'Date', 'Time', 'Customer Name', 'Customer Phone', 'Customer GSTIN', 'Items',
    `Subtotal ${c}`, `Tax ${c}`, `Total incl. Tax ${c}`, `Amount Paid ${c}`, `Diff from Bill ${c}`,
    'Payment Method', 'Split Details', `Change Given ${c}`, 'Status')];
  for (const b of r.bills) {
    const split = b.paymentMethod === 'split' && Array.isArray(b.paymentDetails)
      ? b.paymentDetails.map(e => `${(e.method || '').toUpperCase()} ${c}${Number(e.amount || 0).toFixed(2)}`).join(' + ') : '';
    lines.push(row(
      b.mainId, b.sessionId || '—', b.tableLabel, b.orderType === 'parcel' ? 'Parcel' : 'Dine In',
      localDMY(b.createdAt, r.offset).replace(/-/g, '/'), localTimeOf(b.createdAt, r.offset),
      b.customerName || '—', b.customerPhone || '—', b.gstin || '—',
      b.items.map(i => `${i.quantity}x ${i.name}${i.note ? ` (${i.note})` : ''}`).join(' | '),
      b.taxable.toFixed(2), b.tax.toFixed(2), b.total.toFixed(2), b.amountPaid.toFixed(2),
      diffText(round2(b.amountPaid - b.total)), b.paymentMethod || '—', split || '—', b.changeAmount.toFixed(2), 'closed'));
  }
  return lines;
}

function toCsv(report) {
  const c = report.profile.currency;
  const lines = [...summaryLines(report, c), ...tableLines(report, c), ...orderLines(report, c)];
  return `\uFEFF${lines.join('\r\n')}`;
}

module.exports = { toCsv };
