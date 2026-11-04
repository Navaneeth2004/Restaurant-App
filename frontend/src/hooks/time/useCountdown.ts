import { useCallback, useEffect, useState } from 'react';

/** Whole seconds left until an ISO timestamp (0 once passed). Ticks only while a deadline is set. */
export function useCountdown(expiresAt: string | null): number {
  const calc = useCallback((): number => (expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0), [expiresAt]);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!expiresAt) return undefined;
    const id = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(id);
  }, [expiresAt, calc]);
  return left;
}
