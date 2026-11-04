import type { Order } from 'types/restaurant/orders';
import type { OrderItemCancelledEvent } from 'types/core/realtime';
import { afterItemCancelled, afterRoundCancelled, hasOpenOrders, isForeignSession, withOrder } from './kiosk-orders';

const order = (id: string, status: Order['status'] = 'active', items = 1): Order => ({
  id, table_id: 'T1', status, created_at: '2026-01-01T00:00:00Z', delivered_at: null, total: 10,
  items: Array.from({ length: items }, (_, i) => ({ menu_item_id: i + 1, name: 'x', price: 10, quantity: 1, note: '' })),
});
const cancelled = (updatedOrder: Order): OrderItemCancelledEvent => ({
  orderId: updatedOrder.id, tableId: 'T1', cancelledItem: updatedOrder.items[0] ?? { menu_item_id: 1, name: 'x', price: 1, quantity: 1, note: '' },
  orderStatus: 'active', updatedOrder,
});

test('a repeated order event replaces the round instead of adding a copy', () => {
  const once = withOrder([], order('a'));
  expect(withOrder(once, { ...order('a'), status: 'delivered' })).toEqual([{ ...order('a'), status: 'delivered' }]);
});

test('cancelling one item updates the round, cancelling the last item removes it', () => {
  const list = [order('a', 'active', 2), order('b')];
  expect(afterItemCancelled(list, cancelled(order('a', 'active', 1))).find(o => o.id === 'a')?.items).toHaveLength(1);
  expect(afterItemCancelled(list, cancelled({ ...order('b'), items: [] })).map(o => o.id)).toEqual(['a']);
});

test('a cancelled round disappears', () => {
  expect(afterRoundCancelled([order('a'), order('b')], 'a').map(o => o.id)).toEqual(['b']);
});

test('open orders are active or delivered ones', () => {
  expect(hasOpenOrders([])).toBe(false);
  expect(hasOpenOrders([order('a', 'closed')])).toBe(false);
  expect(hasOpenOrders([order('a', 'delivered')])).toBe(true);
});

test('a different session id is foreign, a missing one is not', () => {
  expect(isForeignSession('s1', { session_id: 's2' })).toBe(true);
  expect(isForeignSession('s1', { session_id: 's1' })).toBe(false);
  expect(isForeignSession(null, { session_id: 's2' })).toBe(false);
  expect(isForeignSession('s1', {})).toBe(false);
});
