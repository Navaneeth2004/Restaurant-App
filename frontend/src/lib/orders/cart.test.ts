import { addToCart, changeQty, decreaseItem, itemQuantity, setNote } from './cart';

const wings = { id: 1, name: 'Wings', price: 5 };

test('adding the same item increments its plain line', () => {
  const a = addToCart(addToCart([], wings), wings);
  expect(a).toEqual([{ menu_item_id: 1, name: 'Wings', price: 5, quantity: 2, note: '' }]);
});

test('a line with a note stays separate', () => {
  const withNote = setNote(addToCart([], wings), 0, 'spicy');
  const next = addToCart(withNote, wings);
  expect(next).toHaveLength(2);
  expect(itemQuantity(next, 1)).toBe(2);
});

test('changeQty removes a line that reaches zero and never mutates', () => {
  const start = addToCart([], wings);
  const frozen = JSON.stringify(start);
  expect(changeQty(start, 0, -1)).toEqual([]);
  expect(JSON.stringify(start)).toBe(frozen);
});

test('decreaseItem prefers the plain line, else the last line', () => {
  let lines = addToCart([], wings);
  lines = setNote(lines, 0, 'a');
  lines = addToCart(lines, wings);
  lines = decreaseItem(lines, 1);
  expect(lines.map(l => l.note)).toEqual(['a']);
  expect(decreaseItem(lines, 99)).toEqual(lines);
});
