import { useCallback, useEffect, useState } from 'react';
import { getStoredTheme, setTheme, Theme, THEME_EVENT } from './theme';

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, set] = useState<Theme>(getStoredTheme);
  useEffect(() => {
    const sync = (): void => set(getStoredTheme());
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(THEME_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const toggle = useCallback(() => setTheme(getStoredTheme() === 'light' ? 'dark' : 'light'), []);
  return { theme, toggle };
}
