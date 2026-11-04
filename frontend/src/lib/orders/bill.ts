import { round2 } from '../format/money';

export interface BillTotals { subtotal: number; tax: number; total: number }

/** "5" -> 5. Invalid or negative input falls back (the backend allows 0-100). */
export function parseTaxPercent(raw: string | undefined, fallback = 5): number {
  const n = Number.parseFloat(raw ?? '');
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Mirrors the server's rounding (tax rounded to 2dp, then added). Only used for a bill that is
 * not closed yet; closed visits must display the server's figures.
 */
export function billTotals(subtotal: number, taxPercent: number): BillTotals {
  const sub = round2(subtotal);
  const tax = round2(sub * taxPercent / 100);
  return { subtotal: sub, tax, total: round2(sub + tax) };
}
