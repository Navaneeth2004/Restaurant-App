import { reorderList } from './reorder';

const items = [{ id: '1' }, { id: '2' }, { id: '10' }];
const id = (i: { id: string }): string => i.id;

test('moves an item to the target position', () => {
  expect(reorderList(items, '1', '10', id)?.map(id)).toEqual(['2', '10', '1']);
  expect(reorderList(items, '10', '1', id)?.map(id)).toEqual(['10', '1', '2']);
});
test('numeric-looking STRING ids are never mixed up with numbers', () => {
  expect(reorderList(items, '2', '1', id)?.map(id)).toEqual(['2', '1', '10']);
  expect(reorderList(items, 2, '1', id)).toBeNull();
});
test('same or unknown ids change nothing and never mutate', () => {
  const frozen = JSON.stringify(items);
  expect(reorderList(items, '1', '1', id)).toBeNull();
  expect(reorderList(items, 'x', '1', id)).toBeNull();
  expect(JSON.stringify(items)).toBe(frozen);
});
