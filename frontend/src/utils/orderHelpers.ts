/**
 * utils/orderHelpers.ts
 *
 * Shared helpers for order classification. Previously isDirectBill() was
 * copy-pasted verbatim in OrderContent.tsx, TotalsBar.tsx, and
 * utils/sessions.ts — any future change to the heuristic required editing
 * all three in lockstep. Consolidated here; all three now import from this
 * single source.
 *
 * The backend has its own equivalent, isDirectBillOrder() in
 * backend/routes/orders.js. It can't literally share this file (different
 * runtime), but uses the identical `diff < 2000` heuristic — keep both in
 * sync manually if this ever changes.
 */

import type { Order } from '../types';

/**
 * Returns true if a 'delivered'/'closed' order was created via /direct-bill
 * (never went through the kitchen's 'active' state). The backend sets
 * delivered_at = created_at atomically for direct-bill orders, so any
 * 'delivered' order whose delivered_at is within ~2 seconds of created_at
 * is treated as direct-billed — everything else went through the normal
 * active → delivered flow.
 */
export function isDirectBill(order: Order): boolean {
  if (!order.delivered_at || !order.created_at) return false;
  const diff = Math.abs(
    new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime()
  );
  return diff < 2000;
}