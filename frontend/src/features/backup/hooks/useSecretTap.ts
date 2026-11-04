import { useCallback, useEffect, useRef, useState } from 'react';

/** Taps `count` times within `windowMs` of each other flips `revealed` on. Counting lives in refs, not in a state updater. */
export function useSecretTap(count: number, windowMs: number): { revealed: boolean; tap: () => void; hide: () => void } {
  const [revealed, setRevealed] = useState(false);
  const taps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => { taps.current = 0; if (timer.current) { clearTimeout(timer.current); timer.current = null; } }, []);
  useEffect(() => reset, [reset]);

  const tap = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    taps.current += 1;
    if (taps.current >= count) { reset(); setRevealed(true); return; }
    timer.current = setTimeout(reset, windowMs);
  }, [count, windowMs, reset]);

  return { revealed, tap, hide: () => setRevealed(false) };
}
