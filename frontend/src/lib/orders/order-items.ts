export interface LineItem { name: string; price: number; quantity: number; note?: string | null }
export interface MergedItem { name: string; price: number; quantity: number; note: string }

/** Merges identical lines (same name + note + price) across rounds. Input is not mutated. */
export function mergeItems(lines: ReadonlyArray<LineItem>): MergedItem[] {
  const map = new Map<string, MergedItem>();
  for (const l of lines) {
    const note = l.note ?? '';
    const key = `${l.name}||${note}||${l.price}`;
    const hit = map.get(key);
    if (hit) hit.quantity += l.quantity;
    else map.set(key, { name: l.name, price: l.price, quantity: l.quantity, note });
  }
  return Array.from(map.values());
}

export const countQuantity = (lines: ReadonlyArray<{ quantity: number }>): number =>
  lines.reduce((s, l) => s + l.quantity, 0);

/** Idempotent merge by id: replaces existing entries, appends new ones. */
export function upsertById<T extends { id: string | number }>(list: ReadonlyArray<T>, item: T): T[] {
  return list.some(x => x.id === item.id) ? list.map(x => (x.id === item.id ? item : x)) : [...list, item];
}
export const removeById = <T extends { id: string | number }>(list: ReadonlyArray<T>, id: T['id']): T[] =>
  list.filter(x => x.id !== id);

const DIRECT_BILL_WINDOW_MS = 2000;

/**
 * A "direct bill" never went through the kitchen: the backend stamps delivered_at = created_at in one step,
 * so a delivered order whose two timestamps are within ~2s is treated as direct-billed.
 * Mirror of backend isDirectBillOrder(): keep the two in sync.
 */
export function isDirectBill(o: { status: string; created_at: string; delivered_at: string | null }): boolean {
  if (o.status === 'billed_direct') return true;
  if (!o.delivered_at || !o.created_at) return false;
  return Math.abs(new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) < DIRECT_BILL_WINDOW_MS;
}
