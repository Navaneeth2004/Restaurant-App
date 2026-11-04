import { useCallback, useMemo } from 'react';
import { createCategory, deleteCategory, listCategories, listMenu, renameCategory, reorderCategories } from 'api/restaurant/catalog.api';
import { EVENTS } from 'config/events';
import { useAsync } from 'hooks/async/useAsync';
import { useToastAction } from 'hooks/async/useToastAction';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type { Category } from 'types/restaurant/catalog';
import { useReorderable } from '../../hooks/useReorderable';

const NONE: Category[] = [];

export function useCategories() {
  const loadCats = useCallback((s: AbortSignal) => listCategories(s), []);
  const loadMenu = useCallback((s: AbortSignal) => listMenu(s), []);
  const cats = useAsync(loadCats);
  const menu = useAsync(loadMenu);
  const { reload: reloadCats } = cats;
  const { reload: reloadMenu } = menu;
  const reload = useCallback(() => { reloadCats(); reloadMenu(); }, [reloadCats, reloadMenu]);

  const order = useReorderable({ server: cats.data ?? NONE, reload });
  useSocketEvent(EVENTS.categoriesUpdated, order.onExternalChange);
  useSocketEvent(EVENTS.menuUpdated, order.onExternalChange);
  useRefetchOnReconnect(reload);

  const counts = useMemo(() => {
    const c = new Map<number, number>();
    for (const m of menu.data ?? []) c.set(m.category_id, (c.get(m.category_id) ?? 0) + 1);
    return c;
  }, [menu.data]);

  const { busy, run } = useToastAction();
  const mutate = async (fn: () => Promise<unknown>, success: string, failure: string): Promise<boolean> => {
    const ok = await run(fn, { success, failure });
    if (ok) reload();
    return ok;
  };
  return {
    categories: order.items, counts, busy,
    loading: cats.loading && cats.data === null, error: cats.error ?? menu.error, reload,
    onReorder: (next: Category[]) => order.reorder(next, () => reorderCategories(next.map((c, i) => ({ id: c.id, sort_order: i })))),
    add: (name: string) => mutate(() => createCategory(name), 'Category added', 'Could not add the category'),
    rename: (id: number, name: string) => mutate(() => renameCategory(id, name), 'Renamed', 'Could not rename'),
    remove: (id: number) => mutate(() => deleteCategory(id), 'Deleted', 'Cannot delete — it still has menu items'),
  };
}
