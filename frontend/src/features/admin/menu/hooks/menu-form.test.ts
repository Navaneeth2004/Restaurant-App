import { buildMenuFormData, MenuFormValues, validateMenuForm } from './menu-form';

const base: MenuFormValues = { name: ' Wings ', description: '', price: '0', categoryId: '2', available: true, image: null };

test('a price of 0 is valid and is sent as "0" (not as an empty string)', () => {
  expect(validateMenuForm(base)).toBeNull();
  expect(buildMenuFormData(base).get('price')).toBe('0');
  expect(buildMenuFormData(base).get('name')).toBe('Wings');
});
test('validation messages', () => {
  expect(validateMenuForm({ ...base, name: ' ' })).toMatch(/name/);
  expect(validateMenuForm({ ...base, price: '' })).toMatch(/price/);
  expect(validateMenuForm({ ...base, price: '-1' })).toMatch(/price/);
  expect(validateMenuForm({ ...base, categoryId: '' })).toMatch(/category/);
  const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png');
  expect(validateMenuForm({ ...base, image: big })).toMatch(/5 MB/);
});
test('only a newly picked photo is sent; the server cannot remove a saved one so nothing like remove_image is sent', () => {
  expect(buildMenuFormData(base).get('image')).toBeNull();
  expect(buildMenuFormData(base).get('remove_image')).toBeNull();
  const f = new File(['x'], 'a.png');
  expect(buildMenuFormData({ ...base, image: f }).get('image')).toBeInstanceOf(File);
});
