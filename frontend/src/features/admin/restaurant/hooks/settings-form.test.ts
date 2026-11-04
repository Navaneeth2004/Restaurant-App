import { clampField, fromSettings, toPatch, validateSettings } from './settings-form';
import { DEFAULT_SETTINGS } from 'state/settings/settings-context';

const ok = fromSettings(DEFAULT_SETTINGS);

test('defaults fill the GST fields', () => {
  expect(ok).toMatchObject({ state_name: 'Kerala', sac_code: '9963', b2b_enabled: 'false', gstin: '' });
  expect(validateSettings(ok)).toBeNull();
});
test('numeric fields are clamped by the keyboard path, non-numbers are ignored', () => {
  expect(clampField('1000000', 0, 100)).toBe('100');
  expect(clampField('-5', 0, 100)).toBe('0');
  expect(clampField('', 0, 100)).toBe('');
  expect(clampField('abc', 0, 100)).toBeNull();
});
test('tax is allowed up to 100 (backend range) but not beyond', () => {
  expect(validateSettings({ ...ok, tax_percent: '18' })).toBeNull();
  expect(validateSettings({ ...ok, tax_percent: '100' })).toBeNull();
  expect(validateSettings({ ...ok, tax_percent: '101' })).toMatch(/Tax/);
  expect(validateSettings({ ...ok, tax_percent: '' })).toMatch(/Tax/);
});
test('colour, GSTIN and overdue minutes are checked', () => {
  expect(validateSettings({ ...ok, brand_color: '#12' })).toMatch(/colour/);
  expect(validateSettings({ ...ok, gstin: '22AAAAA' })).toMatch(/GSTIN/);
  expect(validateSettings({ ...ok, gstin: '22AAAAA0000A1Z5' })).toBeNull();
  expect(validateSettings({ ...ok, kitchen_overdue_mins: '0' })).toMatch(/overdue/);
});
test('the patch never contains the admin lock config or the logo', () => {
  const p = toPatch({ ...ok, gstin: ' 22aaaaa0000a1z5 ' });
  expect(p.gstin).toBe('22AAAAA0000A1Z5');
  expect(Object.keys(p)).not.toContain('admin_lock_config');
  expect(Object.keys(p)).not.toContain('logo_url');
});
