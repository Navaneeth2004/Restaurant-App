import { useEffect, useState } from 'react';

/** Current time in ms, refreshed every `ms`. Replaces the old "force re-render" useTick. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
