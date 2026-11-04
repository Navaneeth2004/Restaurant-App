import { isParcelId, isParcelTable, tableDisplayLabel } from './ids';

test('parcel ids', () => {
  expect(isParcelId('P1')).toBe(true);
  expect(isParcelId('P12')).toBe(true);
  expect(isParcelId('T1')).toBe(false);
  expect(isParcelId('1P')).toBe(false);
});
test('display labels', () => {
  expect(tableDisplayLabel('P3')).toBe('Parcel 3');
  expect(tableDisplayLabel('4')).toBe('Table 4');
});
test('isParcelTable prefers the server flag', () => {
  expect(isParcelTable({ id: '4', is_parcel: 1 })).toBe(true);
  expect(isParcelTable({ id: 'P1' })).toBe(true);
  expect(isParcelTable({ id: 'P1', is_parcel: 0 })).toBe(false);
});
