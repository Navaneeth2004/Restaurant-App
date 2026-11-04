import type { NewOrderItem } from 'types/restaurant/orders';

export type CartLine = NewOrderItem;
interface Addable { id: number; name: string; price: number }

/** Adds one unit. A plain (note-less) line of the same item is incremented; otherwise a new line is appended. */
export function addToCart(lines: ReadonlyArray<CartLine>, item: Addable): CartLine[] {
  const i = lines.findIndex(l => l.menu_item_id === item.id && !l.note);
  if (i !== -1) return lines.map((l, idx) => (idx === i ? { ...l, quantity: l.quantity + 1 } : l));
  return [...lines, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1, note: '' }];
}

/** Changes a line's quantity; a line that reaches 0 is removed. */
export function changeQty(lines: ReadonlyArray<CartLine>, index: number, delta: number): CartLine[] {
  return lines
    .map((l, idx) => (idx === index ? { ...l, quantity: l.quantity + delta } : l))
    .filter(l => l.quantity > 0);
}

export const setNote = (lines: ReadonlyArray<CartLine>, index: number, note: string): CartLine[] =>
  lines.map((l, idx) => (idx === index ? { ...l, note } : l));

/** Removes one unit of an item: prefers its plain line, otherwise the most recently added line. */
export function decreaseItem(lines: ReadonlyArray<CartLine>, menuItemId: number): CartLine[] {
  let idx = lines.findIndex(l => l.menu_item_id === menuItemId && !l.note);
  if (idx === -1) {
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].menu_item_id === menuItemId) { idx = i; break; }
  }
  return idx === -1 ? [...lines] : changeQty(lines, idx, -1);
}

export const itemQuantity = (lines: ReadonlyArray<CartLine>, menuItemId: number): number =>
  lines.filter(l => l.menu_item_id === menuItemId).reduce((s, l) => s + l.quantity, 0);
