import type { Order, OrderType, SplitPayment } from 'types/restaurant/orders';
import { billTotals } from './bill';
import { round2 } from '../format/money';
import { isDirectBill, mergeItems, MergedItem } from './order-items';
import { parseSplitDetails } from '../reports/payment';

/** One dining visit = every kitchen round that shares a session. This is what the server bills, exports and reports. */
export interface Visit {
  key: string;
  tableId: string;
  orders: Order[];
  kitchenRounds: Order[];
  startedAt: string;
  items: MergedItem[];
  subtotal: number;
  /** Tax rate this visit was closed with. */
  rate: number;
  /** false = legacy row without a recorded rate: the current setting was used instead. */
  rateRecorded: boolean;
  tax: number;
  total: number;
  /** What was actually paid; the bill total when the server stored no amount. */
  amountPaid: number;
  paymentMethod: string | null;
  split: SplitPayment[];
  orderType: OrderType;
  customerName: string | null;
  customerPhone: string | null;
  customerGstin: string | null;
  editedAt: string | null;
  invoiceNo: number | null;
}

/** Same key the backend uses to group a bill (services/billing/bills.js). Orders without a session are a visit of their own. */
export const visitKey = (o: Order): string => (o.session_id ? `${o.table_id}|${o.session_id}` : `single|${o.id}`);

const time = (iso: string): number => Date.parse(iso);

function newestValue<T>(newestFirst: ReadonlyArray<Order>, pick: (o: Order) => T | null | undefined): T | null {
  for (const o of newestFirst) {
    const v = pick(o);
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return null;
}

function buildVisit(rows: ReadonlyArray<Order>, fallbackRate: number): Visit {
  const orders = [...rows].sort((a, b) => time(a.created_at) - time(b.created_at));
  const newestFirst = [...orders].reverse();
  const first = orders[0];

  const snapshot = orders.find(o => typeof o.tax_percent_snapshot === 'number');
  const rate = snapshot && typeof snapshot.tax_percent_snapshot === 'number' ? snapshot.tax_percent_snapshot : fallbackRate;
  const items = mergeItems(orders.flatMap(o => o.items));
  const { subtotal, tax, total } = billTotals(round2(orders.reduce((s, o) => s + (o.total || 0), 0)), rate);
  const payer = newestFirst.find(o => !!o.payment_method) ?? null;
  const gstin = newestValue(newestFirst, o => o.customer_gstin?.trim());
  const edits = orders.map(o => o.edited_at).filter((v): v is string => !!v).sort();

  return {
    key: visitKey(first), tableId: first.table_id, orders, kitchenRounds: orders.filter(o => !isDirectBill(o)),
    startedAt: first.created_at, items, subtotal, rate, rateRecorded: !!snapshot, tax, total,
    amountPaid: newestValue(newestFirst, o => o.amount_paid) ?? total,
    paymentMethod: payer ? payer.payment_method ?? null : null,
    split: payer && payer.payment_method === 'split' ? parseSplitDetails(payer.payment_details) : [],
    orderType: first.order_type === 'parcel' ? 'parcel' : 'dine_in',
    customerName: newestValue(newestFirst, o => o.customer_name),
    customerPhone: newestValue(newestFirst, o => o.customer_phone),
    customerGstin: gstin ? gstin.toUpperCase() : null,
    editedAt: edits.length ? edits[edits.length - 1] : null,
    invoiceNo: orders.find(o => typeof o.invoice_no === 'number')?.invoice_no ?? null,
  };
}

/** Closed orders -> visits, newest visit first. Money comes from the server's per-order totals and the rate stored with the visit. */
export function groupVisits(orders: ReadonlyArray<Order>, fallbackRate: number): Visit[] {
  const groups = new Map<string, Order[]>();
  for (const o of orders) {
    const key = visitKey(o);
    const list = groups.get(key);
    if (list) list.push(o); else groups.set(key, [o]);
  }
  return Array.from(groups.values(), rows => buildVisit(rows, fallbackRate)).sort((a, b) => time(b.startedAt) - time(a.startedAt));
}
