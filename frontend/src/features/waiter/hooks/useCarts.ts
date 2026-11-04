import { useCallback, useState } from 'react';
import { addToCart, changeQty, CartLine, decreaseItem, setNote } from 'lib/orders/cart';
import type { MenuItem } from 'types/restaurant/catalog';

const EMPTY: CartLine[] = [];

/** One unsent cart PER TABLE, kept in memory: switching tables never discards what was typed. */
export function useCarts(tableId: string | null) {
  const [carts, setCarts] = useState<Record<string, CartLine[]>>({});
  const cart = tableId ? carts[tableId] ?? EMPTY : EMPTY;

  const update = useCallback((fn: (lines: CartLine[]) => CartLine[]) => {
    if (!tableId) return;
    setCarts(prev => ({ ...prev, [tableId]: fn(prev[tableId] ?? EMPTY) }));
  }, [tableId]);

  const clearTable = useCallback((id: string) => {
    setCarts(prev => { const { [id]: removed, ...rest } = prev; return removed === undefined ? prev : rest; });
  }, []);

  return {
    cart,
    add: useCallback((item: MenuItem) => update(l => addToCart(l, item)), [update]),
    decrease: useCallback((menuItemId: number) => update(l => decreaseItem(l, menuItemId)), [update]),
    changeQty: useCallback((i: number, d: number) => update(l => changeQty(l, i, d)), [update]),
    setNote: useCallback((i: number, n: string) => update(l => setNote(l, i, n)), [update]),
    clear: useCallback(() => update(() => EMPTY), [update]),
    clearTable,
  };
}
