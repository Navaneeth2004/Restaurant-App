import { removeById, upsertById } from 'lib/orders/order-items';
import type { Order } from 'types/restaurant/orders';
import type { OrderItemCancelledEvent } from 'types/core/realtime';

/** Live changes to the customer's list of rounds. All of them are idempotent (merge/remove by id). */
export const withOrder = (orders: ReadonlyArray<Order>, order: Order): Order[] => upsertById(orders, order);

/** The server sends an empty `updatedOrder` when the cancelled item was the round's last one: the round is gone. */
export function afterItemCancelled(orders: ReadonlyArray<Order>, e: OrderItemCancelledEvent): Order[] {
  const left = e.updatedOrder;
  return 'status' in left && left.items.length > 0 ? upsertById(orders, left) : removeById(orders, e.orderId);
}

export const afterRoundCancelled = (orders: ReadonlyArray<Order>, orderId: string): Order[] => removeById(orders, orderId);

export const hasOpenOrders = (orders: ReadonlyArray<Order>): boolean =>
  orders.some(o => o.status === 'active' || o.status === 'delivered');

/** A phone that scanned the QR of an earlier visit sees orders of a newer one: it must rescan. */
export const isForeignSession = (current: string | null, order: { session_id?: string | null }): boolean =>
  !!current && !!order.session_id && order.session_id !== current;
