import { useCallback, useMemo } from 'react';
import { createTable, deleteTable, listTables, reorderTables, updateTable } from 'api/restaurant/tables.api';
import { EVENTS } from 'config/events';
import { useAsync } from 'hooks/async/useAsync';
import { useToastAction } from 'hooks/async/useToastAction';
import { isParcelTable } from 'lib/input/ids';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type { Table } from 'types/restaurant/tables';
import { useReorderable } from '../../hooks/useReorderable';
import { nextTableLabel } from './table-labels';

const NONE: Table[] = [];
export interface TableForm { label: string; seats: number }

export function useAdminTables() {
  const load = useCallback((s: AbortSignal) => listTables(s), []);
  const { data, error, loading, reload } = useAsync(load);
  // Parcel slots belong to the waiter screen, not to the admin's table list.
  const dineIn = useMemo(() => (data ?? NONE).filter(t => !isParcelTable(t)), [data]);
  const order = useReorderable({ server: dineIn, reload });
  useSocketEvent(EVENTS.tablesUpdated, order.onExternalChange);
  useRefetchOnReconnect(reload);

  const { busy, run } = useToastAction();
  const mutate = async (fn: () => Promise<unknown>, success: string, failure: string): Promise<boolean> => {
    const ok = await run(fn, { success, failure });
    if (ok) reload();
    return ok;
  };
  return {
    tables: order.items, busy, error, reload, loading: loading && data === null,
    nextLabel: nextTableLabel(order.items.map(t => t.label)),
    onReorder: (next: Table[]) => order.reorder(next, () => reorderTables(next.map((t, i) => ({ id: t.id, sort_order: i })))),
    add: (f: TableForm) => mutate(() => createTable(f), 'Table added', 'Could not add the table'),
    edit: (id: string, f: TableForm) => mutate(() => updateTable(id, f), 'Updated', 'Could not update the table'),
    remove: (id: string) => mutate(() => deleteTable(id), 'Deleted', 'Could not delete the table'),
  };
}
