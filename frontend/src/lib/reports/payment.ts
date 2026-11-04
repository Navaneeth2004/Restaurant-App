import { SHORT_WARN_ABS, SHORT_WARN_PCT } from 'config/payment';
import { parseNumber } from '../input/input';
import { round2 } from '../format/money';
import type { SplitPayment } from 'types/restaurant/orders';

export interface SplitEntry { method: string; amount: string }

const num = (raw: string): number => parseNumber(raw) ?? 0;

export const splitSum = (entries: ReadonlyArray<SplitEntry>): number => round2(entries.reduce((s, e) => s + num(e.amount), 0));

/** What the customer actually paid: split sum, or the typed amount (empty = exactly the bill). */
export function paidAmount(method: string, received: string, splits: ReadonlyArray<SplitEntry>, total: number): number {
  if (method === 'split') return splitSum(splits);
  return received.trim() === '' ? total : round2(num(received));
}

export const cashChange = (received: number, total: number): number => round2(Math.max(0, received - total));

export function isBigShortfall(total: number, paid: number): boolean {
  const diff = round2(total - paid);
  return diff > 0 && (diff > total * SHORT_WARN_PCT || diff > SHORT_WARN_ABS);
}

/** Quick-amount buttons: the exact bill and the next round numbers above it. */
export function quickAmounts(total: number): number[] {
  const steps = [total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100];
  return steps.filter((v, i) => steps.indexOf(v) === i);
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** The server stores split details as a JSON string (or an array). Anything unreadable gives an empty list. */
export function parseSplitDetails(details: unknown): SplitPayment[] {
  let value = details;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  const out: SplitPayment[] = [];
  for (const e of value) {
    if (!isRecord(e)) continue;
    const amount = Number(e.amount);
    if (!Number.isFinite(amount)) continue;
    out.push({ method: typeof e.method === 'string' && e.method ? e.method : 'cash', amount });
  }
  return out;
}
