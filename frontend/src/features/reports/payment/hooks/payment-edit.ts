import { LIMITS } from 'config/constants';
import { todayStr } from 'lib/format/local-time';
import type { PaymentEditInput } from 'types/restaurant/orders';
import { buildPaymentInput, PaymentForm } from 'features/billing/payment-input';

const two = (n: number): string => String(n).padStart(2, '0');

/** The local date ("YYYY-MM-DD") and time ("HH:MM") of an ISO timestamp, as the date/time inputs want them. */
export function startParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return { date: todayStr(d), time: `${two(d.getHours())}:${two(d.getMinutes())}` };
}

/**
 * The new visit start as an ISO string, or undefined when the date/time were not changed (or are invalid).
 * Sending nothing when nothing changed matters: the inputs only have minute precision, so re-sending would shift every round.
 */
export function editedStart(originalIso: string, date: string, time: string): string | undefined {
  const original = startParts(originalIso);
  if (date === original.date && time === original.time) return undefined;
  return startIsValid(date, time) ? new Date(`${date}T${time}:00`).toISOString() : undefined;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
/** Strict on purpose: the engine happily parses an empty string as the year 2000. */
export const startIsValid = (date: string, time: string): boolean =>
  DATE_RE.test(date) && TIME_RE.test(time) && !Number.isNaN(new Date(`${date}T${time}:00`).getTime());

/** A problem with the GSTIN field, or null. A GSTIN that was already saved is never rejected (it may predate the check). */
export function gstinProblem(gstin: string, saved: string | null): string | null {
  const g = gstin.trim().toUpperCase();
  if (!g || g === saved) return null;
  return g.length === LIMITS.gstin ? null : `A GSTIN has ${LIMITS.gstin} characters.`;
}

/**
 * The body of PATCH /orders/:id/payment. Blank customer fields are left out: the server keeps what it has
 * (it cannot clear a name, phone or GSTIN once saved).
 */
export function buildEditInput(form: PaymentForm, total: number, start: { original: string; date: string; time: string }): PaymentEditInput {
  const input: PaymentEditInput = buildPaymentInput(form, total);
  const created = editedStart(start.original, start.date, start.time);
  return created ? { ...input, created_at: created } : input;
}
