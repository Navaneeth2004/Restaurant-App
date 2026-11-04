import { act, renderHook } from '@testing-library/react';
import { useCarts } from './useCarts';
import type { MenuItem } from 'types/restaurant/catalog';

const item: MenuItem = { id: 1, name: 'Wings', description: '', price: 5, category_id: 1, category_name: 'Starters', image_path: null, available: 1 };

test('each table keeps its own unsent cart', () => {
  const { result, rerender } = renderHook(({ id }) => useCarts(id), { initialProps: { id: 'A' as string | null } });
  act(() => result.current.add(item));
  act(() => result.current.add(item));
  expect(result.current.cart[0].quantity).toBe(2);
  rerender({ id: 'B' });
  expect(result.current.cart).toEqual([]);
  act(() => result.current.add(item));
  rerender({ id: 'A' });
  expect(result.current.cart[0].quantity).toBe(2);
});

test('clearTable drops only that table; no table means no-op', () => {
  const { result, rerender } = renderHook(({ id }) => useCarts(id), { initialProps: { id: 'A' as string | null } });
  act(() => result.current.add(item));
  act(() => result.current.clearTable('A'));
  expect(result.current.cart).toEqual([]);
  rerender({ id: null });
  act(() => result.current.add(item));
  expect(result.current.cart).toEqual([]);
});
