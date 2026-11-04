import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from 'api/errors';
import { REORDER_SETTLE_MS } from 'config/constants';
import { useTimeouts } from 'hooks/time/useTimeouts';
import { useToast } from 'state/toast/useToast';

interface Args<T> { server: ReadonlyArray<T>; reload: () => void }

/**
 * Optimistic reordering that never fights the server's own echo.
 *  - the dragged order is shown immediately;
 *  - socket-triggered reloads that arrive while saving are DEFERRED (not dropped) and run once after saving settles;
 *  - on failure the screen reverts to the server order and says why.
 */
export function useReorderable<T>({ server, reload }: Args<T>) {
  const [local, setLocal] = useState<T[] | null>(null);
  const saving = useRef(false);
  const pending = useRef(false);
  const later = useTimeouts();
  const toast = useToast();

  useEffect(() => { if (!saving.current) setLocal(null); }, [server]); // fresh server data replaces the optimistic order

  /** Call this from socket handlers instead of `reload`. */
  const onExternalChange = useCallback(() => { if (saving.current) pending.current = true; else reload(); }, [reload]);

  const reorder = useCallback(async (next: T[], persist: () => Promise<void>): Promise<void> => {
    saving.current = true;
    setLocal(next);
    try { await persist(); }
    catch (e) { toast(errorMessage(e, 'Failed to save the new order'), 'error'); setLocal(null); }
    finally {
      pending.current = true; // always refresh once after a save, success or not
      later(() => { saving.current = false; if (pending.current) { pending.current = false; reload(); } }, REORDER_SETTLE_MS);
    }
  }, [toast, later, reload]);

  return { items: local ?? server, reorder, onExternalChange };
}
