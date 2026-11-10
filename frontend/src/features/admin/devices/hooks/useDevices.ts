import { useCallback, useEffect, useState } from 'react';
import { createPairingCode, listDevices, removeDevice } from 'api/access/devices.api';
import { WINDOW_EVENTS } from 'config/events';
import { useAsync } from 'hooks/async/useAsync';
import { useCountdown } from 'hooks/time/useCountdown';
import { useToastAction } from 'hooks/async/useToastAction';
import type { Device, PairingCode } from 'types/core/auth';

const NONE: Device[] = [];
const POLL_WHILE_PAIRING_MS = 5000;

export function useDevices() {
  const load = useCallback((s: AbortSignal) => listDevices(s), []);
  const { data, error, loading, reload } = useAsync(load);
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const secondsLeft = useCountdown(pairing?.expires_at ?? null);
  const { busy, run } = useToastAction();

  // The countdown reads 0 for one render right after a code appears, so check the real expiry time too.
  useEffect(() => {
    if (pairing && secondsLeft === 0 && Date.parse(pairing.expires_at) <= Date.now()) setPairing(null);
  }, [pairing, secondsLeft]);
  useEffect(() => {          // while a code is showing, watch for the new device appearing in the list
    if (!pairing) return undefined;
    const id = setInterval(reload, POLL_WHILE_PAIRING_MS);
    return () => clearInterval(id);
  }, [pairing, reload]);

  const createCode = useCallback((roleLock: string | null) => run(async () => { setPairing(await createPairingCode(roleLock)); }, { failure: 'Could not create a code' }), [run]);
  const remove = useCallback(async (d: Device): Promise<void> => {
    const ok = await run(() => removeDevice(d.id), { success: d.is_current ? 'This device was removed' : 'Device removed', failure: 'Failed to remove the device' });
    if (!ok) return;
    if (d.is_current) window.dispatchEvent(new Event(WINDOW_EVENTS.deviceLost));
    else reload();
  }, [run, reload]);

  return { devices: data ?? NONE, loading: loading && data === null, error, reload, busy, pairing, secondsLeft, createCode, remove };
}
