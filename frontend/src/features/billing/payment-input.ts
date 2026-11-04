import { round2 } from 'lib/format/money';
import { parseNumber } from 'lib/input/input';
import { cashChange, paidAmount, SplitEntry } from 'lib/reports/payment';
import type { OrderType, PaymentInput } from 'types/restaurant/orders';

export interface PaymentForm {
  orderType: OrderType;
  method: string;
  received: string;
  splits: SplitEntry[];
  customerName: string;
  customerPhone: string;
  customerGstin: string;
}

const blank = (v: string): string | undefined => v.trim() || undefined;

/** The body of PATCH /orders/:id/close. Amounts are rounded; the phone is sent as typed (the server normalises it). */
export function buildPaymentInput(f: PaymentForm, total: number): PaymentInput {
  const paid = paidAmount(f.method, f.received, f.splits, total);
  const received = parseNumber(f.received);
  let details: PaymentInput['payment_details'] = null;
  let change = 0;
  if (f.method === 'split') {
    details = f.splits.filter(s => (parseNumber(s.amount) ?? 0) > 0).map(s => ({ method: s.method, amount: round2(parseNumber(s.amount) ?? 0) }));
  } else {
    change = f.method === 'cash' ? cashChange(received ?? total, total) : 0;
    if (received !== null) details = { received, change };
  }
  return {
    payment_method: f.method, payment_details: details, change_amount: change,
    customer_name: blank(f.customerName), customer_phone: blank(f.customerPhone), customer_gstin: blank(f.customerGstin),
    amount_paid: paid, order_type: f.orderType,
  };
}
