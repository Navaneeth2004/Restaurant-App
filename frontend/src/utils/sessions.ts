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

// Orders without a session_id are "legacy" (created before the session_id column
// was added). We group them by table with a 4-hour gap heuristic: if more than
// 4 hours pass between consecutive orders at the same table, they are treated as
// separate dining sessions. This avoids merging a January visit with a June visit.
const LEGACY_SESSION_GAP_MS = 4 * 60 * 60 * 1000;

/**
 * Groups orders into dining sessions using the `session_id` field.
 *
 * Modern orders (with session_id): grouped by their session_id — exact.
 * Legacy orders (no session_id): grouped per table using a 4-hour gap heuristic.
 */
export function groupOrdersIntoSessions(orders: Order[]): TableSession[] {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const sessions: TableSession[] = [];
  const sessionMap: Record<string, number> = {}; // sessionKey → sessions index

  for (const order of sorted) {
    const sessionId = (order as any).session_id as string | undefined;

    // For legacy orders, find an existing session at the same table within the gap window.
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