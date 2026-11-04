import { useCallback } from 'react';
import { getTableStats } from 'api/restaurant/tables.api';
import { useAsync } from 'hooks/async/useAsync';
import type { TableStats } from 'types/restaurant/tables';

interface Loaded { tableId: string; stats: TableStats | null }

/** Today's numbers for ONE empty table. Tagged with the table id so a late reply cannot show on another table. */
export function useTableStats(tableId: string, enabled: boolean) {
  const load = useCallback(async (signal: AbortSignal): Promise<Loaded> => ({ tableId, stats: enabled ? await getTableStats(tableId, signal) : null }), [tableId, enabled]);
  const { data, error } = useAsync(load);
  const current = data !== null && data.tableId === tableId;
  return { stats: current && data ? data.stats : null, error, loading: enabled && !current && !error };
}
