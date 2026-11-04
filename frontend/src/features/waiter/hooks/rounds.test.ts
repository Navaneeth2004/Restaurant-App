import { ordersSubtotal, splitRounds } from './rounds';
import type { Order } from 'types/restaurant/orders';

const o = (id: string, status: Order['status'], created: string, delivered: string | null, price = 5): Order => ({
  id, table_id: '1', status, created_at: created, delivered_at: delivered, total: price,
  items: [{ id: 1, menu_item_id: 1, name: 'Wings', price, quantity: 2, note: '' }],
});

test('orders are split into kitchen / direct / active', () => {
  const orders = [
    o('a', 'delivered', '2026-01-01T10:00:00Z', '2026-01-01T10:20:00Z'),
    o('b', 'delivered', '2026-01-01T10:30:00Z', '2026-01-01T10:30:00Z'),
    o('c', 'active', '2026-01-01T10:40:00Z', null),
  ];
  const r = splitRounds(orders);
  expect(r.kitchen.map(x => x.id)).toEqual(['a']);
  expect(r.direct.map(x => x.id)).toEqual(['b']);
  expect(r.active?.id).toBe('c');
});

test('subtotal sums every line and rounds to 2dp', () => {
  expect(ordersSubtotal([o('a', 'delivered', 'x', null, 3.333), o('b', 'active', 'x', null, 1)])).toBe(8.67);
  expect(ordersSubtotal([])).toBe(0);
});
