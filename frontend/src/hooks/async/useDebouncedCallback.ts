import { useCallback, useEffect, useRef } from 'react';

export function useDebouncedCallback<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { fnRef.current = fn; });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useCallback((...a: A) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...a), ms);
  }, [ms]);
}
