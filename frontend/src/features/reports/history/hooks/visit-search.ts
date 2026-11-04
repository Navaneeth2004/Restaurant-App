import { tableDisplayLabel } from 'lib/input/ids';
import type { Visit } from 'lib/orders/visits';

/** Lowercase, keep only letters, digits and dots (so "98765-43210" finds "9876543210"). */
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9.]/g, '');

/**
 * Does a visit match the search text? Looks at customer name/phone/GSTIN, items, table, payment method and the
 * amounts (bill total, paid, subtotal). Pure and instant: it filters the visits already loaded.
 */
export function matchesVisit(v: Visit, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = [
    v.tableId, tableDisplayLabel(v.tableId), v.customerName, v.customerPhone, v.customerGstin, v.paymentMethod,
    ...v.split.map(s => s.method), ...v.items.map(i => i.name),
  ].filter(Boolean).join(' ').toLowerCase();
  if (text.includes(q)) return true;

  const qn = norm(query);
  if (qn && [v.customerPhone, v.customerGstin].some(f => f && norm(f).includes(qn))) return true;

  const typed = parseFloat(query.replace(/[^0-9.]/g, ''));
  if (Number.isNaN(typed) || !/[0-9]/.test(query)) return false;
  return [v.total, v.amountPaid, v.subtotal].some(c => Math.abs(c - typed) < 0.005 || c.toFixed(2).startsWith(query.trim()));
}
