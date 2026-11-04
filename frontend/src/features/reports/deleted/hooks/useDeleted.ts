import { useCallback, useMemo } from 'react';
import { listDeletedRecords } from 'api/restaurant/orders.api';
import { useAsync } from 'hooks/async/useAsync';
import { round2 } from 'lib/format/money';

/** The read-only audit log of visits deleted from History. */
export function useDeleted() {
  const load = useCallback((s: AbortSignal) => listDeletedRecords(s), []);
  const { data, loading, error, reload } = useAsync(load);
  const totalRemoved = useMemo(() => round2((data ?? []).reduce((s, r) => s + r.bill_total, 0)), [data]);
  return { rows: data, loading, error, reload, totalRemoved };
}
