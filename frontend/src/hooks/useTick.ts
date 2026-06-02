import { useState, useEffect } from 'react';

/** Forces a re-render every `ms` milliseconds — used to keep timers live. */
export function useTick(ms = 30000): void {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set(n => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
