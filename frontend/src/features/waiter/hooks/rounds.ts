import { isDirectBill } from 'lib/orders/order-items';
import { sumLines } from 'lib/format/money';
import type { Order, OrderItem } from 'types/restaurant/orders';

export interface Rounds {
  /** Rounds that went through the kitchen and were delivered, oldest first. */
  kitchen: Order[];
  /** Items billed straight away, never sent to the kitchen. */
  direct: Order[];
  /** The round currently in the kitchen (at most one). */
  active: Order | null;
}

export function splitRounds(orders: ReadonlyArray<Order>): Rounds {
  const past = orders.filter(o => o.status === 'delivered' || o.status === 'billed_direct');
  return {
    kitchen: past.filter(o => !isDirectBill(o)),
    direct: past.filter(isDirectBill),
    active: orders.find(o => o.status === 'active') ?? null,
  };
}

export const orderItems = (orders: ReadonlyArray<Order>): OrderItem[] => orders.flatMap(o => o.items);
export const ordersSubtotal = (orders: ReadonlyArray<Order>): number => sumLines(orderItems(orders));
