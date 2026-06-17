/**
 * utils/sessions.ts
 *
 * Groups a flat list of closed orders into "dining sessions" —
 * one session = one customer sitting at one table.
 *
 * Extracted from ReportsView.tsx.
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
  customerName:  string | null;
  customerPhone: string | null;
}

/**
 * Groups orders into dining sessions using the `session_id` field.
 *
 * Key rule: once a table's orders are all 'closed', any subsequent order
 * for that table is ALWAYS a new session — regardless of time gap.
 *
 * NOTE: the legacy fallback `legacy-${order.table_id}` is intentionally
 * kept for backward-compat with old orders that pre-date the session_id
 * column. Those old orders will all be grouped together per table, which
 * is the least-bad option without a time-based heuristic.
 */
export function groupOrdersIntoSessions(orders: Order[]): TableSession[] {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const sessions: TableSession[] = [];
  const sessionMap: Record<string, number> = {}; // sessionKey → sessions index

  for (const order of sorted) {
    const sessionId = (order as any).session_id as string | undefined;
    const key       = sessionId ?? `legacy-${order.table_id}`;

    const existingIdx = sessionMap[key];

    if (existingIdx !== undefined) {
      // Merge into existing session
      const existing = sessions[existingIdx];
      existing.orders.push(order);
      existing.endedAt      = order.created_at;
      existing.totalAmount += order.items.reduce((s, i) => s + i.price * i.quantity, 0);

      if ((order as any).payment_method) {
        existing.paymentMethod  = (order as any).payment_method;
        existing.paymentDetails = (order as any).payment_details;
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

    // New session
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
      customerName:   (order as any).customer_name   || null,
      customerPhone:  (order as any).customer_phone  || null,
    };

    sessionMap[key] = sessions.length;
    sessions.push(session);
  }

  return sessions.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}