import { useCallback } from 'react';
import { listTables } from 'api/restaurant/tables.api';
import { EVENTS } from 'config/events';
import { useAsync } from 'hooks/async/useAsync';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type { Table } from 'types/restaurant/tables';

const NONE: Table[] = [];

export function useTables() {
  const load = useCallback((signal: AbortSignal) => listTables(signal), []);
  const { data, error, loading, reload } = useAsync(load);
  useSocketEvent(EVENTS.tablesUpdated, reload);
  useRefetchOnReconnect(reload);
  return { tables: data ?? NONE, error, loading, reload };
}
