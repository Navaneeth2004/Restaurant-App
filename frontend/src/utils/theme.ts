/**
 * utils/theme.ts
 *
 * Light / dark mode. The choice is stored per DEVICE (localStorage), so the
 * owner's father can use light mode on his phone while the kitchen screen
 * stays dark. Dark remains the default.
 *
 * The theme is applied as <html data-theme="light|dark">; all the colours
 * that change live in src/index.css.
 */

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const KEY   = 'pos_theme';
const EVENT = 'pos-theme-change';

export function getStoredTheme(): Theme {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

export function applyTheme(t: Theme): void {
  document.documentElement.setAttribute('data-theme', t);
}

export function setTheme(t: Theme): void {
  try { localStorage.setItem(KEY, t); } catch {}
  applyTheme(t);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    const sync = () => setThemeState(getStoredTheme());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback(() => {
    setTheme(getStoredTheme() === 'light' ? 'dark' : 'light');
  }, []);

  return { theme, toggle };
}