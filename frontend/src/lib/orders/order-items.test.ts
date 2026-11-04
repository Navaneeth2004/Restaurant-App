import { isDirectBill, mergeItems, countQuantity, upsertById, removeById } from './order-items';

test('mergeItems merges identical lines only', () => {
  const merged = mergeItems([
    { name: 'Wings', price: 5, quantity: 1, note: '' },
    { name: 'Wings', price: 5, quantity: 2, note: null },
    { name: 'Wings', price: 5, quantity: 1, note: 'spicy' },
  ]);
  expect(merged).toEqual([
    { name: 'Wings', price: 5, quantity: 3, note: '' },
    { name: 'Wings', price: 5, quantity: 1, note: 'spicy' },
  ]);
});
test('mergeItems does not mutate input', () => {
  const input = [{ name: 'A', price: 1, quantity: 1 }, { name: 'A', price: 1, quantity: 1 }];
  mergeItems(input);
  expect(input[0].quantity).toBe(1);
});
test('countQuantity', () => {
  expect(countQuantity([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
});
test('upsertById is idempotent', () => {
  const a = [{ id: 'x', v: 1 }];
  const once = upsertById(a, { id: 'x', v: 2 });
  const twice = upsertById(once, { id: 'x', v: 2 });
  expect(twice).toEqual([{ id: 'x', v: 2 }]);
  expect(upsertById(a, { id: 'y', v: 3 })).toHaveLength(2);
});
test('removeById', () => {
  expect(removeById([{ id: 1 }, { id: 2 }], 1)).toEqual([{ id: 2 }]);
});

test('isDirectBill: delivered within 2s of creation, or explicit status', () => {
  const base = { status: 'delivered', created_at: '2026-01-01T10:00:00.000Z' };
  expect(isDirectBill({ ...base, delivered_at: '2026-01-01T10:00:01.000Z' })).toBe(true);
  expect(isDirectBill({ ...base, delivered_at: '2026-01-01T10:05:00.000Z' })).toBe(false);
  expect(isDirectBill({ ...base, delivered_at: null })).toBe(false);
  expect(isDirectBill({ ...base, status: 'billed_direct', delivered_at: null })).toBe(true);
});
