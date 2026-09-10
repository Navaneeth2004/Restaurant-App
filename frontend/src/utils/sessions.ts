/**
 * utils/sessions.ts
 *
 * Groups a flat list of closed orders into "dining sessions" —
 * one session = one customer sitting at one table.
 *
 * FIX (dedup): isDirectBill is now imported from utils/orderHelpers.ts
 * instead of being defined locally — see that file's header comment.
 *
 * (All other fix comments from earlier rounds — amount_paid, round count,
 * parcel labels, customer GSTIN — remain as before.)
 */

import type { Order } from '../types';
import { isDirectBill } from './orderHelpers';

export interface TableSession {
  sessionKey:    string;
  tableId:       string;
  tableLabel?:   string;
  orders:        Order[];
  kitchenRounds: Order[];
  totalAmount:   number;
  startedAt:     string;
  endedAt:       string;
  allItems:      { name: string; price: number; quantity: number; note: string }[];
  paymentMethod: string | null;
  paymentDetails: any;
  amountPaid:    number | null;
  customerName:  string | null;
  customerPhone: string | null;
  customerGstin: string | null;
  orderType:     'dine_in' | 'parcel' | null;
}

const LEGACY_SESSION_GAP_MS = 4 * 60 * 60 * 1000;

export function isParcelId(tableId: string): boolean {
  return /^P\d+$/.test(tableId);
}

export function tableDisplayLabel(tableId: string): string {
  if (isParcelId(tableId)) {
    return `Parcel ${tableId.slice(1)}`;
  }
  return `Table ${tableId}`;
}

export function groupOrdersIntoSessions(orders: Order[]): TableSession[] {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const sessions: TableSession[] = [];
  const sessionMap: Record<string, number> = {};
  const amountPaidOwnerTime: Record<string, number> = {};

  for (const order of sorted) {
    const sessionId = (order as any).session_id as string | undefined;

    let key: string;
    if (sessionId) {
      key = sessionId;
    } else {
      const legacyPrefix = `legacy-${order.table_id}-`;
      const orderTime    = new Date(order.created_at).getTime();
      let found: string | null = null;

      for (const k of Object.keys(sessionMap)) {
        if (!k.startsWith(legacyPrefix)) continue;
        const sess     = sessions[sessionMap[k]];
        const lastTime = new Date(sess.endedAt).getTime();
        if (orderTime - lastTime < LEGACY_SESSION_GAP_MS) { found = k; break; }
      }

      key = found ?? `${legacyPrefix}${order.created_at}`;
    }

    const existingIdx = sessionMap[key];
    const orderIsDirectBill = isDirectBill(order);
    const orderTimeMs = new Date(order.created_at).getTime();
    const orderAmountPaid = (order as any).amount_paid;
    const hasAmountPaid = orderAmountPaid != null;

    if (existingIdx !== undefined) {
      const existing = sessions[existingIdx];
      existing.orders.push(order);
      if (!orderIsDirectBill) existing.kitchenRounds.push(order);
      existing.endedAt      = order.created_at;
      existing.totalAmount += order.items.reduce((s, i) => s + i.price * i.quantity, 0);

      if ((order as any).payment_method) {
        existing.paymentMethod  = (order as any).payment_method;
        existing.paymentDetails = (order as any).payment_details;
      }
      if ((order as any).order_type) {
        existing.orderType = (order as any).order_type;
      }

      if (hasAmountPaid) {
        const currentOwnerTime = amountPaidOwnerTime[key];
        if (currentOwnerTime === undefined || orderTimeMs >= currentOwnerTime) {
          existing.amountPaid = orderAmountPaid;
          amountPaidOwnerTime[key] = orderTimeMs;
        }
      }

      if ((order as any).customer_name)  existing.customerName  = (order as any).customer_name;
      if ((order as any).customer_phone) existing.customerPhone = (order as any).customer_phone;
      if ((order as any).customer_gstin) existing.customerGstin = (order as any).customer_gstin;

      for (const item of order.items) {
        const itemKey = `${item.name}||${item.note || ''}||${item.price}`;
        const found   = existing.allItems.find(
          x => `${x.name}||${x.note || ''}||${x.price}` === itemKey
        );
        if (found) {
          found.quantity += item.quantity;
        } else {
          existing.allItems.push({
            name: item.name, price: item.price,
            quantity: item.quantity, note: item.note || '',
          });
        }
      }
      continue;
    }

    let parsedPayDetails: any = null;
    try {
      if ((order as any).payment_details) {
        parsedPayDetails =
          typeof (order as any).payment_details === 'string'
            ? JSON.parse((order as any).payment_details)
            : (order as any).payment_details;
      }
    } catch {}

    const session: TableSession = {
      sessionKey:    key,
      tableId:       order.table_id,
      orders:        [order],
      kitchenRounds: orderIsDirectBill ? [] : [order],
      totalAmount:   order.items.reduce((s, i) => s + i.price * i.quantity, 0),
      startedAt:     order.created_at,
      endedAt:       order.created_at,
      allItems:      order.items.map(i => ({
        name: i.name, price: i.price, quantity: i.quantity, note: i.note || '',
      })),
      paymentMethod:  (order as any).payment_method  || null,
      paymentDetails: parsedPayDetails,
      amountPaid:     hasAmountPaid ? orderAmountPaid : null,
      customerName:   (order as any).customer_name   || null,
      customerPhone:  (order as any).customer_phone  || null,
      customerGstin:  (order as any).customer_gstin  || null,
      orderType:      (order as any).order_type || null,
    };

    if (hasAmountPaid) amountPaidOwnerTime[key] = orderTimeMs;

    sessionMap[key] = sessions.length;
    sessions.push(session);
  }

  return sessions.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}