import { useCallback } from 'react';
import { errorMessage } from 'api/errors';
import { useToast } from 'state/toast/useToast';
import { useBusy } from './useBusy';

interface Messages { success?: string; failure: string }

/** Runs one mutation: blocks double submit, toasts the server's error text or a success message. Resolves true on success. */
export function useToastAction(): { busy: boolean; run: (fn: () => Promise<unknown>, m: Messages) => Promise<boolean> } {
  const [busy, exec] = useBusy();
  const toast = useToast();
  const run = useCallback(async (fn: () => Promise<unknown>, m: Messages): Promise<boolean> => {
    const ok = await exec(async () => {
      try { await fn(); return true; }
      catch (e) { toast(errorMessage(e, m.failure), 'error'); return false; }
    });
    if (ok && m.success) toast(m.success, 'success');
    return ok === true;
  }, [exec, toast]);
  return { busy, run };
}
