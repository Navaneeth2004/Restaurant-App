import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { getSettings } from 'api/restaurant/settings.api';
import { isAbort } from 'api/http';
import { EVENTS } from 'config/events';
import { STORAGE } from 'config/storage-keys';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type { Settings } from 'types/core/settings';
import { applyBrand } from './applyBrand';
import { DEFAULT_SETTINGS, SettingsContext } from './settings-context';

function readCache(): Settings {
  try {
    const raw = sessionStorage.getItem(STORAGE.settingsCache);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* corrupt or unavailable cache: use defaults */ }
  return DEFAULT_SETTINGS;
}
function writeCache(s: Settings): void {
  try { sessionStorage.setItem(STORAGE.settingsCache, JSON.stringify(s)); } catch { /* cache is optional */ }
}

export default function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(readCache);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    getSettings(ctrl.signal)
      .then(s => { const full = { ...DEFAULT_SETTINGS, ...s }; setSettings(full); writeCache(full); })
      .catch((e: unknown) => { if (!isAbort(e)) console.warn('Could not load settings', e); });
    return () => ctrl.abort();
  }, [tick]);

  useSocketEvent<Partial<Settings>>(EVENTS.settingsUpdated, patch => {
    setSettings(prev => ({ ...prev, ...patch }));
  });
  useRefetchOnReconnect(refresh);

  useEffect(() => { writeCache(settings); applyBrand(settings.brand_color); }, [settings]);

  const value = useMemo(() => ({ settings, refresh }), [settings, refresh]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
