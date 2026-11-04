import { useCallback, useState } from 'react';
import { createParcelSlot, deleteParcelSlot } from 'api/restaurant/tables.api';
import { errorMessage } from 'api/errors';
import { useBusy } from 'hooks/async/useBusy';
import { useToast } from 'state/toast/useToast';

export function useCreateParcel(onCreated: () => void, onDone: () => void) {
  const [busy, run] = useBusy();
  const [error, setError] = useState<unknown>(null);
  const toast = useToast();

  const create = useCallback((name: string, phone: string) => run(async () => {
    setError(null);
    try {
      const slot = await createParcelSlot({ customer_name: name.trim() || undefined, customer_phone: phone.trim() || undefined });
      toast(`${slot.label ?? 'Parcel slot'} created`, 'success');
      onCreated();
      onDone();
    } catch (e) { setError(e); }
  }), [run, toast, onCreated, onDone]);

  return { busy, error, create };
}

/** Removes a parcel slot (only possible once its order is billed and closed). */
export function useRemoveParcel() {
  const toast = useToast();
  return useCallback(async (id: string, label: string): Promise<boolean> => {
    try { await deleteParcelSlot(id); toast(`${label} removed`, 'success'); return true; }
    catch (e) { toast(errorMessage(e, 'Cannot remove — close the order first'), 'error'); return false; }
  }, [toast]);
}
