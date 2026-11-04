import { applyTheme, getStoredTheme, setTheme, THEME_EVENT } from './theme';

beforeEach(() => localStorage.clear());

test('defaults to dark', () => expect(getStoredTheme()).toBe('dark'));
test('setTheme stores, applies and notifies', () => {
  const spy = jest.fn();
  window.addEventListener(THEME_EVENT, spy);
  setTheme('light');
  expect(getStoredTheme()).toBe('light');
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  expect(spy).toHaveBeenCalledTimes(1);
  window.removeEventListener(THEME_EVENT, spy);
});
test('applyTheme only sets the attribute', () => {
  applyTheme('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});
