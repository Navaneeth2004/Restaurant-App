import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { getDeviceStatus } from 'api/access/device.api';
import { isApiError } from 'api/errors';
import { isAbort, FailureDetail } from 'api/http';
import { DEVICE_STATUS_POLL_MS } from 'config/constants';
import { WINDOW_EVENTS } from 'config/events';
import { closeSocket } from 'realtime/socket';
import type { DeviceStatus } from 'types/core/auth';
import { DeviceContext } from './device-context';

export default function DeviceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [offline, setOffline] = useState(false);
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    getDeviceStatus(ctrl.signal)
      .then(s => { setStatus(s); setOffline(false); if (s.linked) setSuspendedMessage(null); })
      .catch((e: unknown) => {
        if (isAbort(e)) return;
        if (isApiError(e) && e.isNetwork) setOffline(true); // keep the app up through a network blip
      });
    return () => ctrl.abort();
  }, [tick]);

  useEffect(() => {
    const id = setInterval(refresh, DEVICE_STATUS_POLL_MS);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(id); window.removeEventListener('focus', refresh); };
  }, [refresh]);

  useEffect(() => {
    const onLost = (e: Event): void => {
      const d = (e as CustomEvent<FailureDetail>).detail;
      closeSocket();
      setSuspendedMessage(d?.code === 'restaurant_suspended' ? d.message : null);
      setStatus(prev => ({ linked: false, suspended: d?.code === 'restaurant_suspended', registration_open: prev?.registration_open ?? true }));
    };
    window.addEventListener(WINDOW_EVENTS.deviceLost, onLost);
    return () => window.removeEventListener(WINDOW_EVENTS.deviceLost, onLost);
  }, []);

  const value = useMemo(() => ({ status, offline, suspendedMessage, refresh }), [status, offline, suspendedMessage, refresh]);
  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}
