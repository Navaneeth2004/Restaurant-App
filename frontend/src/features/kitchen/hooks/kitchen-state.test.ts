import { initialKitchen, kitchenReducer, KitchenState } from './kitchen-state';
import type { Order, OrderItem } from 'types/restaurant/orders';

const item = (id: number, name = 'Wings'): OrderItem => ({ id, menu_item_id: id, name, price: 5, quantity: 1, note: '' });
const order = (id: string, items: OrderItem[] = [item(1)]): Order => ({
  id, table_id: '1', status: 'active', created_at: '2026-01-01T10:00:00Z', delivered_at: null, total: 5, items,
});

test('order events are idempotent and order-independent', () => {
  let s = kitchenReducer(initialKitchen, { type: 'order', order: order('a') });
  s = kitchenReducer(s, { type: 'order', order: order('a') });
  expect(s.orders).toHaveLength(1);
  s = kitchenReducer(s, { type: 'loaded', orders: [order('a'), order('b')] });
  s = kitchenReducer(s, { type: 'order', order: order('b') });
  expect(s.orders.map(o => o.id)).toEqual(['a', 'b']);
});

test('delivered removes the order and its addition notices', () => {
  const base: KitchenState = {
    orders: [order('a')], cancellations: [],
    additions: [{ id: 'x', orderId: 'a', tableId: '1', additions: [item(2)], createdAt: '' }],
  };
  const s = kitchenReducer(base, { type: 'delivered', orderId: 'a' });
  expect(s.orders).toEqual([]);
  expect(s.additions).toEqual([]);
});

test('duplicate addition id is ignored', () => {
  const add = { id: 'x', orderId: 'a', tableId: '1', additions: [item(2)], createdAt: '' };
  let s = kitchenReducer(initialKitchen, { type: 'addition', addition: add });
  s = kitchenReducer(s, { type: 'addition', addition: add });
  expect(s.additions).toHaveLength(1);
});

const cancel = { id: 'c1', orderId: 'a', tableId: '1', type: 'item' as const, items: [item(1)], createdAt: '' };

test('cancelling the last item removes the order; otherwise updates it', () => {
  const base: KitchenState = { orders: [order('a', [item(1), item(2)])], additions: [], cancellations: [] };
  const partial = kitchenReducer(base, { type: 'item-cancelled', cancellation: cancel, updatedOrder: order('a', [item(2)]) });
  expect(partial.orders[0].items).toHaveLength(1);
  const last = kitchenReducer(partial, { type: 'item-cancelled', cancellation: { ...cancel, id: 'c2' }, updatedOrder: order('a', []) });
  expect(last.orders).toEqual([]);
  expect(last.cancellations).toHaveLength(2);
});

test('cancel notices are deduplicated by id', () => {
  const base: KitchenState = { orders: [order('a')], additions: [], cancellations: [] };
  let s = kitchenReducer(base, { type: 'round-cancelled', cancellation: { ...cancel, type: 'round' } });
  s = kitchenReducer(s, { type: 'round-cancelled', cancellation: { ...cancel, type: 'round' } });
  expect(s.cancellations).toHaveLength(1);
  expect(s.orders).toEqual([]);
});

test('dismiss removes only that notice', () => {
  const s: KitchenState = {
    orders: [], additions: [],
    cancellations: [cancel, { ...cancel, id: 'c2' }],
  };
  expect(kitchenReducer(s, { type: 'dismiss-cancellation', id: 'c1' }).cancellations.map(c => c.id)).toEqual(['c2']);
});
