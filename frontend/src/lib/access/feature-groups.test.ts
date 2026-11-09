import { groupFeatures, setFeatureOn, setGroupOn } from './feature-groups';

const defs = [{ key: 'a', group: 'One' }, { key: 'b', group: 'Two' }, { key: 'c', group: 'One' }];

test('groups keep the order they first appear in', () => {
  expect(groupFeatures(defs).map(g => [g.group, g.items.map(i => i.key)])).toEqual([['One', ['a', 'c']], ['Two', ['b']]]);
});
test('a single feature is switched off and on without duplicates or mutation', () => {
  const start = ['x'];
  expect(setFeatureOn(start, 'a', false)).toEqual(['x', 'a']);
  expect(setFeatureOn(['x', 'a'], 'a', false)).toEqual(['x', 'a']);
  expect(setFeatureOn(['x', 'a'], 'a', true)).toEqual(['x']);
  expect(start).toEqual(['x']);
});
test('a whole group is switched off or on at once', () => {
  expect(setGroupOn(['c'], ['a', 'c'], false)).toEqual(['c', 'a']);
  expect(setGroupOn(['a', 'c', 'b'], ['a', 'c'], true)).toEqual(['b']);
});
