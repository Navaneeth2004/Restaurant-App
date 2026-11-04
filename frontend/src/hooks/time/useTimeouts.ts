import { useCallback, useEffect, useRef } from 'react';

/** setTimeout that is cleared automatically on unmount. */
export function useTimeouts(): (fn: () => void, ms: number) => void {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const set = timers.current;
    return () => { set.forEach(clearTimeout); set.clear(); };
  }, []);
  return useCallback((fn, ms) => {
    const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
  }, []);
}
