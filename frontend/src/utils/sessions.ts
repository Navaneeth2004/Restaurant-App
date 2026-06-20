/**
 * utils/sessions.ts
 *
 * Groups a flat list of closed orders into "dining sessions" —
 * one session = one customer sitting at one table.
 */

import type { Order } from '../types';

export interface TableSession {
  sessionKey:    string;
  tableId:       string;
  tableLabel?:   string;
  orders:        Order[];
  totalAmount:   number;
  startedAt:     string;
  endedAt:       string;
  allItems:      { name: string; price: number; quantity: number; note: string }[];
  paymentMethod: string | null;
  paymentDetails: any;
  amountPaid:    number | null;   // FIX: was missing — caused History to always show bill total
  customerName:  string | null;
  customerPhone: string | null;
  /** 'dine_in' or 'parcel' — taken from the most recent round with a value set. */
  orderType:     'dine_in' | 'parcel' | null;
}

const LEGACY_SESSION_GAP_MS = 4 * 60 * 60 * 1000;

export function groupOrdersIntoSessions(orders: Order[]): TableSession[] {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const sessions: TableSession[] = [];
  const sessionMap: Record<string, number> = {};

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

    if (existingIdx !== undefined) {
      const existing = sessions[existingIdx];
      existing.orders.push(order);
      existing.endedAt      = order.created_at;
      existing.totalAmount += order.items.reduce((s, i) => s + i.price * i.quantity, 0);

      if ((order as any).payment_method) {
        existing.paymentMethod  = (order as any).payment_method;
        existing.paymentDetails = (order as any).payment_details;
      }
      // Order type — keep the most recent round's value if set, so an edit
      // made after the fact (which updates the latest round) is reflected.
      if ((order as any).order_type) {
        existing.orderType = (order as any).order_type;
      }
      // FIX: accumulate amount_paid across rounds in a session
      if ((order as any).amount_paid != null) {
        existing.amountPaid = ((existing.amountPaid ?? 0) + (order as any).amount_paid);
      }
      if ((order as any).customer_name)  existing.customerName  = (order as any).customer_name;
      if ((order as any).customer_phone) existing.customerPhone = (order as any).customer_phone;

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
      totalAmount:   order.items.reduce((s, i) => s + i.price * i.quantity, 0),
      startedAt:     order.created_at,
      endedAt:       order.created_at,
      allItems:      order.items.map(i => ({
        name: i.name, price: i.price, quantity: i.quantity, note: i.note || '',
      })),
      paymentMethod:  (order as any).payment_method  || null,
      paymentDetails: parsedPayDetails,
      amountPaid:     (order as any).amount_paid ?? null,   // FIX: read from order
      customerName:   (order as any).customer_name   || null,
      customerPhone:  (order as any).customer_phone  || null,
      orderType:      (order as any).order_type || null,
    };

    sessionMap[key] = sessions.length;
    sessions.push(session);
  }

  return sessions.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}