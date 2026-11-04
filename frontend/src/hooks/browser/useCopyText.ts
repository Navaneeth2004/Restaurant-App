import { useCallback } from 'react';
import { useToast } from 'state/toast/useToast';

/** Copies text and tells the user the truth: the clipboard can be unavailable (plain http, denied permission). */
export function useCopyText(): (label: string, text: string) => Promise<void> {
  const toast = useToast();
  return useCallback(async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); toast(`Copied: ${label}`, 'success'); }
    catch { toast('Could not copy — select the value and copy it by hand', 'error'); }
  }, [toast]);
}
