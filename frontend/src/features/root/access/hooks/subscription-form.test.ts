import type { Subscription } from 'types/office/root';
import { emptyForm, formProblem, toForm, toInput } from './subscription-form';

const keys = [{ key: 'max_staff' }, { key: 'max_tables' }];
const sub: Subscription = { slug: 'lite', name: 'Lite', description: 'd', limits: { max_tables: 20 }, disabled: ['export.gstr9'], restaurants: 2 };

test('a subscription becomes form text; missing limits are blank; a copy gets a new name', () => {
  expect(toForm(sub, keys)).toEqual({ name: 'Lite', description: 'd', limits: { max_staff: '', max_tables: '20' }, disabled: ['export.gstr9'] });
  expect(toForm(sub, keys, true).name).toBe('Copy of Lite');
});
test('blank limits are sent as null (unlimited), numbers as numbers, text is trimmed', () => {
  expect(toInput({ ...toForm(sub, keys), name: ' Lite ' })).toEqual({ name: 'Lite', description: 'd', limits: { max_staff: null, max_tables: 20 }, disabled: ['export.gstr9'] });
});
test('the form needs a name and whole-number limits', () => {
  const ok = toForm(sub, keys);
  expect(formProblem(ok)).toBeNull();
  expect(formProblem({ ...ok, name: ' ' })).toMatch(/name/);
  expect(formProblem({ ...ok, limits: { ...ok.limits, max_staff: '1.5' } })).toMatch(/whole numbers/);
  expect(formProblem({ ...ok, limits: { ...ok.limits, max_staff: '-1' } })).toMatch(/whole numbers/);
  expect(formProblem(emptyForm(keys))).toMatch(/name/);
});
