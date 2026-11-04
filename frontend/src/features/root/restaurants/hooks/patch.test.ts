import type { RestaurantDetail, RootConfig } from 'types/office/root';
import { formProblem, toForm, toPatch } from './patch';

const config: RootConfig = { plans: ['trial'], limit_keys: [{ key: 'max_staff', label: 'Max staff' }, { key: 'max_tables', label: 'Max tables' }], plan_defaults: {}, ticket_statuses: [], enforce_trial: false };
const detail = { name: 'Diner', plan: 'trial', notes: 'n', trial_ends_at: new Date(2026, 5, 30, 23, 59, 59).toISOString(), limits_override: { max_staff: 2 } } as unknown as RestaurantDetail;

test('the trial date is the operator\'s local calendar day and round-trips', () => {
  const f = toForm(detail, config);
  expect(f.trialEnds).toBe('2026-06-30');
  expect(f.limits).toEqual({ max_staff: '2', max_tables: '' });
  expect(toPatch(f).trial_ends_at).toBe(new Date(2026, 5, 30, 23, 59, 59).toISOString());
});

test('blank limits become null (plan default) and numbers stay numbers', () => {
  expect(toPatch({ ...toForm(detail, config), trialEnds: '' })).toMatchObject({ limits: { max_staff: 2, max_tables: null }, trial_ends_at: null });
});

test('validation catches bad limits and an empty name', () => {
  const f = toForm(detail, config);
  expect(formProblem(f)).toBeNull();
  expect(formProblem({ ...f, name: ' ' })).toMatch(/name/);
  expect(formProblem({ ...f, limits: { max_staff: '1.5', max_tables: '' } })).toMatch(/whole number/);
  expect(formProblem({ ...f, limits: { max_staff: '-1', max_tables: '' } })).toMatch(/whole number/);
});
