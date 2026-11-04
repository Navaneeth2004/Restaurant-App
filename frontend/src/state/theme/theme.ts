import { STORAGE } from 'config/storage-keys';

export type Theme = 'dark' | 'light';
export const THEME_EVENT = 'pos-theme-change';

export function getStoredTheme(): Theme {
  try { return localStorage.getItem(STORAGE.theme) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}
export function applyTheme(t: Theme): void {
  document.documentElement.setAttribute('data-theme', t);
}
export function setTheme(t: Theme): void {
  try { localStorage.setItem(STORAGE.theme, t); } catch { /* storage unavailable: theme still applies for this page */ }
  applyTheme(t);
  window.dispatchEvent(new Event(THEME_EVENT));
}
