import { useCallback } from 'react';
import { listCategories, listMenu } from 'api/restaurant/catalog.api';
import { EVENTS } from 'config/events';
import { useAsync } from 'hooks/async/useAsync';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type { Category, MenuItem } from 'types/restaurant/catalog';

const NO_ITEMS: MenuItem[] = [];
const NO_CATS: Category[] = [];

export function useMenu() {
  const loadItems = useCallback((s: AbortSignal) => listMenu(s), []);
  const loadCats = useCallback((s: AbortSignal) => listCategories(s), []);
  const items = useAsync(loadItems);
  const cats = useAsync(loadCats);
  const { reload: reloadItems } = items;
  const { reload: reloadCats } = cats;

  const reloadMenu = useCallback(() => reloadItems(), [reloadItems]);
  const reloadAll = useCallback(() => { reloadItems(); reloadCats(); }, [reloadItems, reloadCats]);
  useSocketEvent(EVENTS.menuUpdated, reloadMenu);
  useSocketEvent(EVENTS.categoriesUpdated, reloadAll);
  useRefetchOnReconnect(reloadAll);

  return {
    items: items.data ?? NO_ITEMS,
    categories: cats.data ?? NO_CATS,
    loading: items.loading || cats.loading,
    error: items.error ?? cats.error,
    reload: reloadAll,
  };
}
