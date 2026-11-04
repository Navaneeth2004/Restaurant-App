import { useCallback } from 'react';
import { listTableOrders } from 'api/restaurant/orders.api';
import { useAsync } from 'hooks/async/useAsync';
import type { Order } from 'types/restaurant/orders';

interface Loaded { tableId: string | null; orders: Order[] }
const NONE: Order[] = [];

/**
 * Orders of ONE table. The result is tagged with its table id, so a slow reply for a table you already
 * left can never be shown for the new one. A failed refresh keeps the last good data (an error is not "empty").
 */
export function useTableOrders(tableId: string | null) {
  const load = useCallback(async (signal: AbortSignal): Promise<Loaded> => (
    tableId ? { tableId, orders: await listTableOrders(tableId, signal) } : { tableId: null, orders: NONE }
  ), [tableId]);
  const { data, error, loading, reload } = useAsync(load);
  const current = data !== null && data.tableId === tableId;
  return { orders: current && data ? data.orders : NONE, loading: tableId !== null && (loading || !current), error, reload };
}
