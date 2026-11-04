import { PAYMENT_METHODS } from 'config/payment';
import { toDateInput, toTimeInput } from 'lib/format/local-time';
import type { RevenueReport, RevenueVisit } from 'types/office/export';
import { Cell, count, money, toCsv } from './csv';

const methodLabel = (key: string): string => PAYMENT_METHODS.find(m => m.key === key)?.label ?? key;

const itemsText = (v: RevenueVisit): string =>
  v.items.map(i => `${i.qty} x ${i.name}${i.note ? ` (${i.note})` : ''}`).join('; ');

const splitText = (v: RevenueVisit): string =>
  (v.split_details ?? []).map(s => `${methodLabel(s.method)} ${s.amount.toFixed(2)}`).join(' + ');

function visitRow(v: RevenueVisit): Cell[] {
  const when = new Date(v.created_at);
  return [
    toDateInput(when), toTimeInput(when), v.table, v.order_type === 'parcel' ? 'Parcel' : 'Dine in',
    v.customer_name ?? '', v.customer_phone ?? '', v.customer_gstin ?? '', itemsText(v),
    money(v.subtotal), money(v.tax), money(v.total_incl_tax), money(v.amount_paid), money(v.diff_from_bill),
    v.payment_method ? methodLabel(v.payment_method) : '', splitText(v),
  ];
}

/** One clean table, one row per visit, oldest first. Dates are the restaurant's local day and time. */
export function visitsCsv(report: RevenueReport, sym: string): string {
  const header = [
    'Date', 'Time', 'Table', 'Type', 'Customer', 'Phone', 'Customer GSTIN', 'Items',
    `Subtotal (${sym})`, `Tax (${sym})`, `Total (${sym})`, `Paid (${sym})`, `Paid minus total (${sym})`, 'Payment', 'Split detail',
  ];
  const rows = [...report.orders].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(visitRow);
  return toCsv(header, rows);
}

/** One clean table, one row per day that had visits. */
export function dailyCsv(report: RevenueReport, sym: string): string {
  const header = ['Date', 'Visits', 'Items sold', `Revenue before tax (${sym})`, `Tax (${sym})`, `Total incl. tax (${sym})`];
  const rows = [...report.daily_breakdown].sort((a, b) => a.date.localeCompare(b.date))
    .map(d => [d.date, count(d.orders), count(d.items_sold), money(d.revenue), money(d.tax), money(d.total_incl_tax)]);
  return toCsv(header, rows);
}

export const revenueJson = (report: RevenueReport): string => `${JSON.stringify(report, null, 2)}\n`;
