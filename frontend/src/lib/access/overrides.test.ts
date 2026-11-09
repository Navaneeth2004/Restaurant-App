import { choiceOf, toChoices, toOverrides } from './overrides';

test('overrides become choices and back, and "inherit" is never sent', () => {
  const choices = toChoices({ 'export.gstr9': true, kiosk: false });
  expect(choices).toEqual({ 'export.gstr9': 'on', kiosk: 'off' });
  expect(choiceOf(choices, 'waiter')).toBe('inherit');
  expect(toOverrides({ ...choices, kiosk: 'inherit' })).toEqual({ 'export.gstr9': true });
});
