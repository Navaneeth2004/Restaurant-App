import { useCallback, useMemo, useState } from 'react';
import { listRestaurants, rootConfig } from 'api/platform/root.api';
import { useAsync } from 'hooks/async/useAsync';

/** The restaurants list with a text + status filter, and the console config (plans, limit names). */
export function useRestaurants() {
  const loadList = useCallback((s: AbortSignal) => listRestaurants(s), []);
  const loadConfig = useCallback((s: AbortSignal) => rootConfig(s), []);
  const list = useAsync(loadList);
  const config = useAsync(loadConfig);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list.data ?? []).filter(r => (status === 'all' || r.status === status) && (!needle || `${r.name} ${r.id} ${r.owner_phone}`.toLowerCase().includes(needle)));
  }, [list.data, q, status]);

  return { list, config: config.data, configError: config.error, rows, q, setQ, status, setStatus };
}
