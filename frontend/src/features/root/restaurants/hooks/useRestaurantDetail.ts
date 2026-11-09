import { useCallback, useEffect, useState } from 'react';
import {
  activateRestaurant, deleteRestaurant, getRestaurant, patchRestaurant, resetOwnerPassword, revokeRestaurantDevices, suspendRestaurant,
} from 'api/platform/root.api';
import { useAsync } from 'hooks/async/useAsync';
import { useToastAction } from 'hooks/async/useToastAction';
import type { RootConfig } from 'types/office/root';
import { DetailForm, formProblem, toForm, toPatch } from './patch';

/** One restaurant's detail screen: data, the editable form, and every action (each reloads the detail and the list). */
export function useRestaurantDetail(id: string, config: RootConfig, onChanged: () => void) {
  const load = useCallback((s: AbortSignal) => getRestaurant(id, s), [id]);
  const { data, error, reload } = useAsync(load);
  const [form, setForm] = useState<DetailForm | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const { busy, run } = useToastAction();

  useEffect(() => { if (data) setForm(toForm(data, config)); }, [data, config]);

  const after = useCallback(() => { reload(); onChanged(); }, [reload, onChanged]);
  const act = (fn: () => Promise<unknown>, success: string, failure: string): Promise<boolean> => run(async () => { await fn(); after(); }, { success, failure });

  const problem = form ? formProblem(form) : null;
  return {
    data, error, reload, form, setForm, problem, busy, secret, clearSecret: () => setSecret(null),
    save: () => (form && !problem ? act(() => patchRestaurant(id, toPatch(form)), 'Saved.', 'Could not save') : Promise.resolve(false)),
    saveFeatures: (features: Record<string, boolean>) => act(() => patchRestaurant(id, { features }), 'Feature settings saved.', 'Could not save the feature settings'),
    suspend: (reason: string) => act(() => suspendRestaurant(id, reason), 'Suspended.', 'Could not suspend'),
    activate: () => act(() => activateRestaurant(id), 'Activated.', 'Could not activate'),
    revokeAll: () => run(async () => { const r = await revokeRestaurantDevices(id); after(); return r.revoked; }, { success: 'Devices revoked.', failure: 'Could not revoke devices' }),
    resetPassword: (pw: string) => run(async () => { const r = await resetOwnerPassword(id, pw.trim() || undefined); if (r.temp_password) setSecret(r.temp_password); after(); }, { success: 'Owner password changed.', failure: 'Could not reset the password' }),
    remove: (name: string, password: string) => run(async () => { await deleteRestaurant(id, name, password); onChanged(); }, { success: 'Restaurant deleted.', failure: 'Could not delete' }),
  };
}
