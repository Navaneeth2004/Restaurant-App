/** Display-only money formatting. Totals come from the server; only the unsent cart is summed locally. */
export function formatMoney(value: number | null | undefined, symbol = '₹'): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${symbol}${n.toFixed(2)}`;
}

/** Round to 2 decimals the same way the server does (single place). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Cart-only helper: an unsent cart has no server total yet. */
export function lineTotal(price: number, quantity: number): number {
  return round2(price * quantity);
}

export function sumLines(lines: ReadonlyArray<{ price: number; quantity: number }>): number {
  return round2(lines.reduce((s, l) => s + lineTotal(l.price, l.quantity), 0));
}
