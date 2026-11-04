import { useCallback, useEffect, useState } from 'react';
import { ensureKioskToken } from 'api/restaurant/tables.api';
import { isAbort } from 'api/http';
import { kioskPath } from 'config/routes';

export interface TableQr { url: string | null; error: unknown; loading: boolean; retry: () => void }

/** The customer-ordering link of one table: `<origin>/kiosk/<token>` (no LAN-IP guessing in cloud mode). */
export function useTableQr(tableId: string): TableQr {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    ensureKioskToken(tableId)
      .then(({ token }) => { if (live) setUrl(`${window.location.origin}${kioskPath(token)}`); })
      .catch((e: unknown) => { if (live && !isAbort(e)) setError(e); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tableId, tick]);

  const retry = useCallback(() => setTick(t => t + 1), []);
  return { url, error, loading, retry };
}
