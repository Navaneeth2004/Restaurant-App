import { useCallback, useEffect } from 'react';
import { rootOverview } from 'api/platform/root.api';
import { useAsync } from 'hooks/async/useAsync';

const REFRESH_MS = 30_000;

export function useOverview() {
  const load = useCallback((s: AbortSignal) => rootOverview(s), []);
  const a = useAsync(load);
  const { reload } = a;
  useEffect(() => { const id = setInterval(reload, REFRESH_MS); return () => clearInterval(id); }, [reload]);
  return a;
}
