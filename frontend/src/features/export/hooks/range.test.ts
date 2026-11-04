import { activePreset, presetRange } from './range';

const now = new Date(2026, 4, 17);
test('presets span from the period start to today', () => {
  expect(presetRange('month', now)).toEqual({ from: '2026-05-01', to: '2026-05-17' });
  expect(presetRange('quarter', now)).toEqual({ from: '2026-04-01', to: '2026-05-17' });
});
test('the active preset follows the dates', () => {
  expect(activePreset(presetRange('quarter', now), now)).toBe('quarter');
  expect(activePreset({ from: '2026-05-02', to: '2026-05-17' }, now)).toBeNull();
});
