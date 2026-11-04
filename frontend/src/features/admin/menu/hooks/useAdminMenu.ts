import { useCallback, useMemo, useState } from 'react';
import { createMenuItem, deleteMenuItem, listCategories, listMenu, reorderMenu, updateMenuItem } from 'api/restaurant/catalog.api';
import { EVENTS } from 'config/events';
import { useAsync } from 'hooks/async/useAsync';
import { useToastAction } from 'hooks/async/useToastAction';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type { Category, MenuItem } from 'types/restaurant/catalog';
import { useReorderable } from '../../hooks/useReorderable';

const NO_ITEMS: MenuItem[] = [];
const NO_CATS: Category[] = [];

export function useAdminMenu() {
  const loadItems = useCallback((s: AbortSignal) => listMenu(s), []);
  const loadCats = useCallback((s: AbortSignal) => listCategories(s), []);
  const items = useAsync(loadItems);
  const cats = useAsync(loadCats);
  const { reload: reloadItems } = items;
  const { reload: reloadCats } = cats;
  const reload = useCallback(() => { reloadItems(); reloadCats(); }, [reloadItems, reloadCats]);

  const order = useReorderable({ server: items.data ?? NO_ITEMS, reload });
  useSocketEvent(EVENTS.menuUpdated, order.onExternalChange);
  useSocketEvent(EVENTS.categoriesUpdated, order.onExternalChange);
  useRefetchOnReconnect(reload);

  const [filter, setFilter] = useState<'all' | number>('all');
  const shown = useMemo(() => (filter === 'all' ? order.items : order.items.filter(i => i.category_id === filter)), [order.items, filter]);
  const { busy, run } = useToastAction();
  const mutate = async (fn: () => Promise<unknown>, success: string, failure: string): Promise<boolean> => {
    const ok = await run(fn, { success, failure });
    if (ok) reload();
    return ok;
  };

  return {
    items: order.items, shown, categories: cats.data ?? NO_CATS, filter, setFilter, busy, reload,
    loading: items.loading && items.data === null, error: items.error ?? cats.error,
    /** Reorders the visible (filtered) items. sort_order = category_id*10000 + position (kept from the old app; flagged). */
    onReorder: (next: MenuItem[]) => {
      const ids = new Set(next.map(i => i.id));
      const merged = [...next, ...order.items.filter(i => !ids.has(i.id))];
      return order.reorder(merged, () => reorderMenu(next.map((it, idx) => ({ id: it.id, sort_order: it.category_id * 10000 + idx }))));
    },
    toggle: (item: MenuItem) => {
      const fd = new FormData();
      fd.append('available', String(!item.available));
      return mutate(() => updateMenuItem(item.id, fd), item.available ? 'Marked sold out' : 'Available again', 'Could not change availability');
    },
    save: (fd: FormData, id?: number) => (id === undefined
      ? mutate(() => createMenuItem(fd), 'Added', 'Could not add the item')
      : mutate(() => updateMenuItem(id, fd), 'Updated', 'Could not update the item')),
    remove: (id: number) => mutate(() => deleteMenuItem(id), 'Deleted', 'Could not delete — the item may be in an active order'),
  };
}
