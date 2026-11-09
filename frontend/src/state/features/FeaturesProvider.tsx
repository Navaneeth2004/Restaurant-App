import { ReactNode, useCallback, useEffect, useMemo } from 'react';
import { getFeatures } from 'api/access/features.api';
import { EVENTS, WINDOW_EVENTS } from 'config/events';
import { useAsync } from 'hooks/async/useAsync';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type { FeatureKey } from './feature-keys';
import { FeaturesContext } from './features-context';

/**
 * Which features root has switched off for this restaurant. Re-read when root changes something (socket), after a
 * reconnect, and when the server refuses a request because a feature is off.
 */
export default function FeaturesProvider({ children }: { children: ReactNode }) {
  const load = useCallback((signal: AbortSignal) => getFeatures(signal), []);
  const { data, reload } = useAsync(load);
  useSocketEvent(EVENTS.featuresUpdated, reload);
  useRefetchOnReconnect(reload);
  useEffect(() => {
    window.addEventListener(WINDOW_EVENTS.featureDisabled, reload);
    return () => window.removeEventListener(WINDOW_EVENTS.featureDisabled, reload);
  }, [reload]);

  const value = useMemo(() => {
    const disabled = data?.disabled ?? {};
    const isOn = (key: FeatureKey): boolean => disabled[key] === undefined;
    return { isOn, anyOn: (keys: ReadonlyArray<FeatureKey>): boolean => keys.some(isOn), refresh: reload };
  }, [data, reload]);

  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}
