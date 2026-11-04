import { useCallback } from 'react';
import { changeStaffPin, createStaff, deleteStaff, listStaff } from 'api/access/staff.api';
import type { Role } from 'config/constants';
import { useAsync } from 'hooks/async/useAsync';
import { useBusy } from 'hooks/async/useBusy';
import { useToastAction } from 'hooks/async/useToastAction';
import { useToast } from 'state/toast/useToast';
import type { Staff } from 'types/core/auth';

const NONE: Staff[] = [];

export function useStaff() {
  const load = useCallback((s: AbortSignal) => listStaff(s), []);
  const { data, error, loading, reload } = useAsync(load);
  const [saving, runSave] = useBusy();
  const { busy, run } = useToastAction();
  const toast = useToast();

  /** Both forms show the server's refusal INLINE (409 duplicate name, weak PIN, plan limit), so these throw. */
  const add = useCallback((f: { name: string; pin: string; role: Role }) => runSave(async () => {
    await createStaff(f);
    toast('Staff added', 'success');
    reload();
  }), [runSave, toast, reload]);
  const setPin = useCallback((id: number, name: string, pin: string) => runSave(async () => {
    await changeStaffPin(id, pin);
    toast(`PIN updated for ${name}`, 'success');
  }), [runSave, toast]);
  const remove = useCallback(async (id: number) => {
    const ok = await run(() => deleteStaff(id), { success: 'Removed', failure: 'Failed to remove staff' });
    if (ok) reload();
  }, [run, reload]);

  return { staff: data ?? NONE, loading: loading && data === null, error, reload, saving, busy, add, setPin, remove };
}
