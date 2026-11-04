import { nextTableLabel } from './table-labels';

test('continues from the highest trailing number', () => {
  expect(nextTableLabel(['Table 1', 'Table 9', 'Patio 3'])).toBe('Table 10');
});
test('without numbers it counts the tables', () => {
  expect(nextTableLabel([])).toBe('Table 1');
  expect(nextTableLabel(['Corner', 'Window'])).toBe('Table 3');
});
