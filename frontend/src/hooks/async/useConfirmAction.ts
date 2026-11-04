import { useCallback, useMemo, useState } from 'react';
import { errorMessage } from 'api/errors';
import { useToast } from 'state/toast/useToast';
import { useBusy } from './useBusy';
import { useIsMounted } from '../time/useIsMounted';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  /** Runs after the user confirms. A thrown error is shown as a toast. */
  action: () => Promise<void>;
  failureText?: string;
}

export interface ConfirmDialogProps {
  title: string; message: string; confirmLabel: string; danger: boolean; busy: boolean;
  onConfirm: () => void; onCancel: () => void;
}

/** "Ask first, then do": spread `dialog` into <ConfirmDialog/> when it is not null. Double-confirm is blocked. */
export function useConfirmAction(): { ask: (r: ConfirmRequest) => void; dialog: ConfirmDialogProps | null } {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [busy, run] = useBusy();
  const toast = useToast();
  const mounted = useIsMounted();

  const ask = useCallback((r: ConfirmRequest) => setRequest(r), []);
  const onCancel = useCallback(() => setRequest(null), []);
  const onConfirm = useCallback(() => {
    if (!request) return;
    void run(async () => {
      try { await request.action(); }
      catch (e) { toast(errorMessage(e, request.failureText), 'error'); }
      finally { if (mounted()) setRequest(null); }
    });
  }, [request, run, toast, mounted]);

  const dialog = useMemo<ConfirmDialogProps | null>(() => (request
    ? { title: request.title, message: request.message, confirmLabel: request.confirmLabel, danger: !!request.danger, busy, onConfirm, onCancel }
    : null), [request, busy, onConfirm, onCancel]);

  return { ask, dialog };
}
