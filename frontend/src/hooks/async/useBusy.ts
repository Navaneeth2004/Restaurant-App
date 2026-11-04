import { useCallback, useRef, useState } from 'react';
import { useIsMounted } from '../time/useIsMounted';

/** Guards a mutation against double submit. While one run is in flight, further calls are ignored. */
export function useBusy(): [boolean, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mounted = useIsMounted();

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      if (mounted()) setBusy(false);
    }
  }, [mounted]);

  return [busy, run];
}
