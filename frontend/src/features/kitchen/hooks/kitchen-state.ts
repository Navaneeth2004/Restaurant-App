import { removeById, upsertById } from 'lib/orders/order-items';
import type { EmptiedOrder } from 'types/core/realtime';
import type { Order, OrderItem } from 'types/restaurant/orders';

export interface Addition { id: string; orderId: string; tableId: string; additions: OrderItem[]; createdAt: string }
export interface Cancellation {
  id: string; orderId: string; tableId: string; type: 'item' | 'round';
  items: OrderItem[]; createdAt: string;
}
export interface KitchenState { orders: Order[]; additions: Addition[]; cancellations: Cancellation[] }

export const initialKitchen: KitchenState = { orders: [], additions: [], cancellations: [] };

export type KitchenAction =
  | { type: 'loaded'; orders: Order[] }
  | { type: 'order'; order: Order }
  | { type: 'delivered'; orderId: string }
  | { type: 'addition'; addition: Addition }
  | { type: 'item-cancelled'; cancellation: Cancellation; updatedOrder: Order | EmptiedOrder | null }
  | { type: 'round-cancelled'; cancellation: Cancellation }
  | { type: 'dismiss-addition'; id: string }
  | { type: 'dismiss-cancellation'; id: string };

const withoutOrder = <T extends { orderId: string }>(list: T[], orderId: string): T[] => list.filter(x => x.orderId !== orderId);

/** Every transition is idempotent: a REST reply and a socket event for the same order may arrive in either order. */
export function kitchenReducer(s: KitchenState, a: KitchenAction): KitchenState {
  switch (a.type) {
    case 'loaded':
      return { ...s, orders: a.orders };
    case 'order':
      return { ...s, orders: upsertById(s.orders, a.order) };
    case 'delivered':
      return { ...s, orders: removeById(s.orders, a.orderId), additions: withoutOrder(s.additions, a.orderId) };
    case 'addition':
      return s.additions.some(x => x.id === a.addition.id) ? s : { ...s, additions: [...s.additions, a.addition] };
    case 'item-cancelled': {
      const left = a.updatedOrder;
      const open = left !== null && 'status' in left && left.items.length > 0 ? left : null;
      const orders = open ? upsertById(s.orders, open) : removeById(s.orders, a.cancellation.orderId);
      return {
        orders,
        additions: open ? s.additions : withoutOrder(s.additions, a.cancellation.orderId),
        cancellations: s.cancellations.some(c => c.id === a.cancellation.id) ? s.cancellations : [...s.cancellations, a.cancellation],
      };
    }
    case 'round-cancelled':
      return {
        orders: removeById(s.orders, a.cancellation.orderId),
        additions: withoutOrder(s.additions, a.cancellation.orderId),
        cancellations: s.cancellations.some(c => c.id === a.cancellation.id) ? s.cancellations : [...s.cancellations, a.cancellation],
      };
    case 'dismiss-addition':
      return { ...s, additions: s.additions.filter(x => x.id !== a.id) };
    case 'dismiss-cancellation':
      return { ...s, cancellations: s.cancellations.filter(x => x.id !== a.id) };
    default:
      return s;
  }
}
