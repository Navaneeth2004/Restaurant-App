import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbort } from 'api/http';

export interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  /** Re-run. Any in-flight older request is aborted and its result ignored. */
  reload: () => void;
}

/** `load` MUST be wrapped in useCallback by the caller; it re-runs when its identity changes. */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    const ctrl = new AbortController();
    setLoading(true);
    load(ctrl.signal)
      .then(v => { if (id === latest.current) { setData(v); setError(null); } })
      .catch((e: unknown) => { if (id === latest.current && !isAbort(e)) setError(e); })
      .finally(() => { if (id === latest.current) setLoading(false); });
    return () => ctrl.abort();
  }, [load, tick]);

  const reload = useCallback(() => setTick(t => t + 1), []);
  return { data, error, loading, reload };
}
