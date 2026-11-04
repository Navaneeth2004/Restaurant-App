export type SortId = string | number;

/** Moves the item `from` to the position of `to`. Returns null when nothing changes (same id, or an unknown id). */
export function reorderList<T>(items: ReadonlyArray<T>, from: SortId, to: SortId, getId: (item: T) => SortId): T[] | null {
  if (from === to) return null;
  const a = items.findIndex(i => getId(i) === from);
  const b = items.findIndex(i => getId(i) === to);
  if (a === -1 || b === -1) return null;
  const next = [...items];
  const [moved] = next.splice(a, 1);
  next.splice(b, 0, moved);
  return next;
}
