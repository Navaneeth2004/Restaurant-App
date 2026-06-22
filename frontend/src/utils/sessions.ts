/**
 * utils/sessions.ts
 *
 * Groups a flat list of closed orders into "dining sessions" —
 * one session = one customer sitting at one table.
 *
 * FIX (amount_paid): amount_paid is recorded ONCE per session on a single
 * order row (see backend/routes/orders.js close route), not duplicated
 * across every order in the session. Previously this code summed
 * amount_paid across every order, so a 3-order session with amount_paid=150
 * on each row reported 450 total. Now we just take the value — if more than
 * one row somehow has a non-null amount_paid (e.g. data from before this
 * fix), the most recently-created order's value wins, since that's the
 * order the close/payment-edit routes treat as canonical.
 *
 * FIX (round count): "rounds" should mean kitchen rounds — orders that were
 * actually sent to the kitchen (status passed through 'active' at some
 * point). Direct-bill orders never go through the kitchen, so they must not
 * inflate the rounds count. `isDirectBill` mirrors the same detection logic
 * used on the waiter-side OrderContent/TotalsBar components (delivered_at
 * ≈ created_at).
 */

import type { Order } from '../types';

export interface TableSession {
  sessionKey:    string;
  tableId:       string;
  tableLabel?:   string;
  orders:        Order[];
  /** Only orders that actually went through the kitchen (excludes direct-bill orders). */
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
  /** 'dine_in' or 'parcel' — taken from the most recent round with a value set. */
  orderType:     'dine_in' | 'parcel' | null;
}

const LEGACY_SESSION_GAP_MS = 4 * 60 * 60 * 1000;

/** Returns true if a 'delivered'/'closed' order was created via /direct-bill
 *  (never went through the kitchen's 'active' state). Mirrors the backend's
 *  isDirectBillOrder() and the frontend waiter-side detection. */
function isDirectBill(order: Order): boolean {
  if (!order.delivered_at || !order.created_at) return false;
  const diff = Math.abs(
    new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime()
  );
  return diff < 2000;
}

export function groupOrdersIntoSessions(orders: Order[]): TableSession[] {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const sessions: TableSession[] = [];
  const sessionMap: Record<string, number> = {};
  // Tracks, per session, the created_at of whichever order currently "owns"
  // amountPaid — used to decide if a newer order's amount_paid should replace
  // an older one if (in legacy data) more than one row has a value set.
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
      // Order type — keep the most recent round's value if set, so an edit
      // made after the fact (which updates the latest round) is reflected.
      if ((order as any).order_type) {
        existing.orderType = (order as any).order_type;
      }

      // FIX: take amount_paid as-is (no summing). If multiple rows somehow
      // carry a value, prefer whichever order is most recent, matching the
      // backend's notion of the "canonical" payment row.
      if (hasAmountPaid) {
        const currentOwnerTime = amountPaidOwnerTime[key];
        if (currentOwnerTime === undefined || orderTimeMs >= currentOwnerTime) {
          existing.amountPaid = orderAmountPaid;
          amountPaidOwnerTime[key] = orderTimeMs;
        }
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